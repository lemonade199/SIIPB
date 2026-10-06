'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { db } from '@/lib/mock/db';
import { addDays, diffDays, fmtDate, relDue, today } from '@/lib/date';
import { capitalize, cn, match, stripQrPrefix } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Field, Select, TextareaField, TextField, toOptions } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Alert, Avatar, Empty, KV, PageHead, Thumb } from '@/components/ui/misc';
import { useToast } from '@/components/providers/feedback-provider';
import { checkout, genCode, updateDraft, type BorrowingSaveResult } from '@/services/borrowing';
import * as repo from '@/services/repo';
import { CAPABILITIES, isApiMode } from '@/lib/config';
import { activeBorrowings, borrowableItems, detailsOf, emp, isBorrowable, item as getItem, itemByCode, loc, unit, conditionLabel } from '@/services/lookup';
import type { FieldErrors, ID, Item } from '@/types';

const STEPS = ['Pilih peminjam', 'Pilih barang', 'Jadwal & tujuan', 'Simpan & checkout'];

function planDates(borrow: string, due: string) {
  const s = db.data.settings;
  const out: { ev: string; date: string; to: string; late?: boolean }[] = [];
  if (s.checkout_notify) out.push({ ev: 'Saat checkout', date: borrow, to: 'Peminjam' });
  s.rules
    .filter((r) => r.active)
    .forEach((r) => {
      const dt = addDays(due, r.days);
      if (r.days < 0 && dt < borrow) return;
      out.push({ ev: r.event, date: dt, to: r.to.map(capitalize).join(' + '), late: r.days > 0 });
    });
  return out;
}

/** Pencatatan peminjaman oleh petugas: peminjam → barang → jadwal → simpan/checkout. */
export function BorrowForm({ id }: { id?: ID }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user, can } = useAuth();
  const editing = id ? db.get('borrowings', id) : null;
  useTitle(id ? 'Ubah draf peminjaman' : 'Catat peminjaman');

  const [employeeId, setEmployeeId] = useState<ID | null>(() => editing?.employee_id ?? (params.get('emp') ? Number(params.get('emp')) : null));
  const [itemIds, setItemIds] = useState<ID[]>(() => {
    if (editing) return detailsOf(editing).map((d) => d.item_id);
    const pre = getItem(Number(params.get('item')));
    return pre && isBorrowable(pre) ? [pre.id] : [];
  });
  const [form, setForm] = useState(() => ({
    borrow_date: editing?.borrow_date ?? today(),
    due_date: editing?.due_date ?? addDays(today(), 3),
    purpose: editing?.purpose ?? '',
    notes: editing?.notes ?? '',
  }));
  const [empQ, setEmpQ] = useState('');
  const [itemQ, setItemQ] = useState('');
  const [itemCat, setItemCat] = useState('');
  const [scan, setScan] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  if (id && (!editing || editing.status !== 'DRAF'))
    return (
      <Card>
        <Empty icon="lock">Hanya transaksi berstatus DRAF yang dapat diubah.</Empty>
      </Card>
    );
  if (!user) return null;

  const e = emp(employeeId);
  const { borrow_date: borrow, due_date: due } = form;
  const dur = borrow && due ? diffDays(borrow, due) : null;
  const plan = borrow && due && dur !== null && dur >= 0 ? planDates(borrow, due) : [];
  const done = [!!e, itemIds.length > 0, !!(borrow && due && dur !== null && dur >= 0 && form.purpose.trim())];

  const employees = db
    .where('employees', (x) => x.active && match(empQ, x.name, x.nip, unit(x.unit_id)?.name, x.email))
    .slice(0, 6);
  const items: Item[] = [...borrowableItems(), ...itemIds.map((i) => getItem(i)).filter((i): i is Item => !!i && !isBorrowable(i))]
    .filter((i) => match(itemQ, i.item_code, i.item_name, i.brand) && (!itemCat || i.category_id === Number(itemCat)))
    .sort((a, b) => a.item_code.localeCompare(b.item_code));

  const toggleItem = (iid: ID, on: boolean) => setItemIds((s) => (on ? [...s, iid] : s.filter((x) => x !== iid)));

  const onScan = () => {
    const code = stripQrPrefix(scan);
    const it = itemByCode(code);
    if (!it) toast(`Kode ${code} tidak ditemukan.`, 'err');
    else if (!isBorrowable(it)) toast(`${it.item_code} tidak dapat dipinjam (status ${it.item_status}${it.active ? '' : ', nonaktif'}).`, 'err');
    else if (itemIds.includes(it.id)) toast(`${it.item_code} sudah dipilih.`, 'warn');
    else {
      setItemIds((s) => [...s, it.id]);
      toast(`${it.item_name} ditambahkan.`);
    }
    setScan('');
  };

  const submit = async (doCheckout: boolean) => {
    if (saving) return;
    const payload = { employee_id: employeeId, item_ids: itemIds, ...form };
    let r: BorrowingSaveResult;
    if (id) {
      r = updateDraft(id, payload);
      if (r.ok && doCheckout) {
        const c = checkout(r.borrowing.id);
        r = c.ok ? { ok: true, borrowing: c.borrowing, notification: c.notification } : { ok: false, errors: { item_ids: c.error } };
      }
    } else {
      setSaving(true);
      r = await repo.createBorrowing(payload, doCheckout);
      setSaving(false);
    }
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    const b = r.borrowing;
    const bEmp = emp(b.employee_id);
    if (doCheckout) {
      const n = r.notification || db.find('notifications', (x) => x.borrowing_id === b.id && x.event === 'CHECKOUT');
      toast(
        `${b.code} diserahkan. Status barang: DIPINJAM.${n ? ` Email ${n.status === 'TERKIRIM' ? 'terkirim' : 'GAGAL dikirim'} ke ${bEmp?.email}.` : ''}`,
        n && n.status !== 'TERKIRIM' ? 'warn' : 'ok',
      );
    } else toast(`Draf ${b.code} disimpan. Status barang belum berubah.`);
    router.push(`/peminjaman/${b.id}`);
  };

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/peminjaman">Peminjaman</Link> / {editing ? 'Ubah draf' : 'Baru'}
          </>
        }
        title={editing ? `Ubah draf ${editing.code}` : 'Catat Peminjaman'}
        desc="Petugas memilih peminjam dan barang, menentukan tanggal, lalu menyerahkan barang. Peminjam tidak mengisi apa pun."
      />
      <section className="card" style={{ padding: '14px 18px', marginBottom: 18 }}>
        <ol className="steps">
          {STEPS.map((s, i) => {
            const isDone = i < 3 && done[i];
            const on = !isDone && done.slice(0, i).every(Boolean);
            return (
              <li key={s} className={cn(isDone && 'done', on && 'on')}>
                <b>{isDone ? <Icon name="check" size={13} /> : i + 1}</b>
                {s}
              </li>
            );
          })}
        </ol>
      </section>

      <form noValidate onSubmit={(ev) => ev.preventDefault()}>
        <div className="split-wide">
          <div className="stack">
            <Card title="1 · Peminjam" desc="Peminjam tidak perlu hadir di sistem — hanya dipilih oleh petugas.">
              <div className="stack" style={{ gap: 10 }}>
                <TextField label="Cari peminjam dari master data" placeholder="Ketik nama, NIP, atau unit kerja…" autoComplete="off" value={empQ} onChange={(ev) => setEmpQ(ev.target.value)} />
                <div className="pick-list" style={{ maxHeight: 236 }} role="radiogroup" aria-label="Peminjam">
                  {employees.length ? (
                    employees.map((x) => {
                      const late = activeBorrowings().filter((b) => b.employee_id === x.id && relDue(b.due_date).n < 0).length;
                      return (
                        <label key={x.id} className={cn(employeeId === x.id && 'sel')}>
                          <input type="radio" name="emp" checked={employeeId === x.id} onChange={() => setEmployeeId(x.id)} />
                          <Avatar name={x.name} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b>{x.name}</b>
                            <span className="cell-sub" style={{ display: 'block' }}>
                              NIP {x.nip} · {unit(x.unit_id)?.name} · {x.email}
                            </span>
                          </span>
                          {late > 0 && <Badge status="TERLAMBAT">{late} terlambat</Badge>}
                        </label>
                      );
                    })
                  ) : (
                    <div className="empty small">
                      Peminjam tidak ditemukan. {can('masterdata.manage') && <Link href="/master/peminjam">Tambah di Master Data</Link>}
                    </div>
                  )}
                </div>
                {errors.employee_id && <span className="err small" style={{ color: 'var(--danger)' }}>{errors.employee_id}</span>}
                {e && (
                  <div className="row" style={{ padding: 12, border: '1px solid #c8d6f5', background: '#f5f8fe', borderRadius: 10, flexWrap: 'nowrap' }}>
                    <Avatar name={e.name} />
                    <div style={{ minWidth: 0 }}>
                      <b>{e.name}</b>
                      <div className="cell-sub">
                        NIP {e.nip} · {unit(e.unit_id)?.name}
                      </div>
                      <div className="cell-sub">
                        <Icon name="mail" size={13} className="inline" /> {e.email}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="2 · Barang">
              <div className="stack" style={{ gap: 10 }}>
                <TextField
                  label="Pindai / ketik kode barang"
                  mono
                  placeholder="INV-… lalu Enter (pemindai QR/barcode)"
                  autoComplete="off"
                  value={scan}
                  onChange={(ev) => setScan(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault();
                      onScan();
                    }
                  }}
                />
                <div className="row">
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Input placeholder="Cari barang tersedia…" aria-label="Cari barang tersedia" value={itemQ} onChange={(ev) => setItemQ(ev.target.value)} />
                  </div>
                  <Select style={{ width: 'auto' }} aria-label="Filter kategori" value={itemCat} onChange={(ev) => setItemCat(ev.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
                </div>
                <div className="pick-list">
                  {items.length ? (
                    items.map((i) => {
                      const on = itemIds.includes(i.id);
                      return (
                        <label key={i.id} className={cn(on && 'sel')}>
                          <Checkbox checked={on} onCheckedChange={(c) => toggleItem(i.id, c === true)} />
                          <Thumb item={i} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b>{i.item_name}</b>
                            <span className="cell-sub" style={{ display: 'block' }}>
                              <span className="mono">{i.item_code}</span> · {loc(i.location_id)?.name} · {conditionLabel(i.condition_status)}
                            </span>
                          </span>
                          <Badge status={i.item_status} />
                        </label>
                      );
                    })
                  ) : (
                    <div className="empty small">Tidak ada barang tersedia yang cocok.</div>
                  )}
                </div>
                <div className="chosen">
                  {itemIds.length ? (
                    itemIds.map((iid) => {
                      const i = getItem(iid);
                      if (!i) return null;
                      return (
                        <span key={iid} className="chip">
                          <span className="mono">{i.item_code}</span> {i.item_name}
                          <button type="button" aria-label={`Hapus ${i.item_code}`} onClick={() => toggleItem(iid, false)}>
                            <Icon name="x" size={14} />
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <span className="small muted">Belum ada barang dipilih.</span>
                  )}
                </div>
                {errors.item_ids && <span className="small" style={{ color: 'var(--danger)' }}>{errors.item_ids}</span>}
                <p className="small muted">
                  <Icon name="info" size={14} className="inline align-[-2px]" /> Hanya barang berstatus <b>TERSEDIA</b> yang ditampilkan. Barang RUSAK_BERAT, HILANG, dan DALAM_PERBAIKAN tidak dapat dipinjam.
                </p>
              </div>
            </Card>

            <Card title="3 · Jadwal & tujuan">
              <div className="form-grid">
                <TextField
                  label="Tanggal peminjaman"
                  type="date"
                  required
                  value={form.borrow_date}
                  error={errors.borrow_date}
                  onChange={(ev) => setForm({ ...form, borrow_date: ev.target.value })}
                />
                <Field label="Batas pengembalian" required error={errors.due_date} htmlFor="f-due" hint={dur === null ? undefined : dur < 0 ? 'Batas kembali sebelum tanggal pinjam.' : `Durasi ${dur} hari · jatuh pada ${fmtDate(due, true)}`}>
                  <Input id="f-due" type="date" className="w-full" aria-invalid={!!errors.due_date || undefined} value={form.due_date} onChange={(ev) => setForm({ ...form, due_date: ev.target.value })} />
                  <div className="row" style={{ gap: 6 }}>
                    {[1, 3, 7, 14].map((n) => (
                      <Button key={n} size="sm" onClick={() => setForm({ ...form, due_date: addDays(form.borrow_date || today(), n) })}>
                        +{n} hari
                      </Button>
                    ))}
                  </div>
                </Field>
                <TextField
                  label="Tujuan peminjaman"
                  required
                  full
                  placeholder="mis. Dokumentasi kegiatan sosialisasi"
                  value={form.purpose}
                  error={errors.purpose}
                  onChange={(ev) => setForm({ ...form, purpose: ev.target.value })}
                />
                <TextareaField
                  label="Catatan petugas"
                  full
                  placeholder="Kelengkapan yang diserahkan, kondisi saat diserahkan, dll."
                  value={form.notes}
                  onChange={(ev) => setForm({ ...form, notes: ev.target.value })}
                />
              </div>
            </Card>
          </div>

          <div className="stack" style={{ position: 'sticky', top: 76 }}>
            <Card title="Ringkasan transaksi">
              <KV
                one
                items={[
                  ['Kode transaksi', <span key="c" className="mono">{editing ? editing.code : isApiMode ? 'Dibuat server (TX-…)' : genCode('borrowings', 'PJM', borrow || today())}</span>],
                  ['Petugas', user.name],
                  ['Peminjam', e ? e.name : <span key="p" className="muted">Belum dipilih</span>],
                  ['Jumlah barang', `${itemIds.length} barang`],
                  ['Tanggal pinjam', fmtDate(borrow)],
                  ['Batas kembali', fmtDate(due)],
                ]}
              />
              {Object.keys(errors).length > 0 && (
                <Alert type="danger" className="mt-3">
                  {Object.values(errors).map((m) => (
                    <div key={m}>{m}</div>
                  ))}
                </Alert>
              )}
              <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                <Button variant="primary" icon="check" block disabled={saving} onClick={() => submit(true)}>
                  {saving ? 'Menyimpan…' : 'Simpan & Serahkan (Checkout)'}
                </Button>
                {CAPABILITIES.drafts && (
                  <Button block disabled={saving} onClick={() => submit(false)}>
                    {editing ? 'Simpan draf' : 'Simpan sebagai draf'}
                  </Button>
                )}
                <p className="small muted">
                  Checkout memvalidasi ketersediaan, mengubah status barang menjadi <b>DIPINJAM</b>, mengirim email ke peminjam, dan mencatat audit log.
                </p>
              </div>
            </Card>
            <Card title="Jadwal notifikasi ke peminjam" desc="Dikirim otomatis; dapat dikonfigurasi di Pengaturan">
              {plan.length ? (
                <ul className="list">
                  {plan.map((x) => (
                    <li key={x.ev} style={{ padding: '8px 0' }}>
                      <span className="mono strong" style={{ width: 92, flexShrink: 0 }}>
                        {x.ev}
                      </span>
                      <span style={{ flex: 1 }} className="small">
                        {fmtDate(x.date)}
                        {x.late && <span className="muted"> (jika belum kembali)</span>}
                      </span>
                      <span className="small muted">{x.to}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Isi tanggal untuk melihat jadwal notifikasi.</p>
              )}
            </Card>
          </div>
        </div>
      </form>
    </>
  );
}
