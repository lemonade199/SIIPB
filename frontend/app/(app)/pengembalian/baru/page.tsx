'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { db } from '@/lib/mock/db';
import { diffDays, fmtDate, today } from '@/lib/date';
import { RETURN_CONDITIONS } from '@/lib/constants';
import { cn, match, stripQrPrefix } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Field, SelectField, TextareaField, TextField } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Alert, Avatar, Empty, KV, PageHead, Thumb } from '@/components/ui/misc';
import { BorrowBadge, DueText, LateText } from '@/components/domain/borrow-status';
import { useToast } from '@/components/providers/feedback-provider';
import { activeBorrowings, borrowingByCode, borrowView, detailsOf, emp, isActive, item as getItem, itemByCode, itemsOf, returnDetails, unit } from '@/services/lookup';
import { type ReturnItemInput } from '@/services/return';
import * as repo from '@/services/repo';
import { CAPABILITIES } from '@/lib/config';
import type { Borrowing, ID, ReturnConditionKey } from '@/types';

export default function ReturnFormPage() {
  useTitle('Catat pengembalian');
  const params = useSearchParams();
  const pinjam = params.get('pinjam');
  if (!pinjam) return <Picker />;
  const b = db.get('borrowings', pinjam);
  if (!b || !isActive(b))
    return (
      <>
        <PageHead title="Catat Pengembalian" />
        <Card>
          <Empty icon="in">
            Transaksi tidak aktif atau sudah dikembalikan. <Link href="/pengembalian/baru">Pilih transaksi lain</Link>.
          </Empty>
        </Card>
      </>
    );
  return <ReturnForm key={b.id} b={b} />;
}

/* ---------- Langkah 1: pilih transaksi aktif ---------- */
function Picker() {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState('');
  const all = activeBorrowings();
  const list = all
    .filter((b) => {
      const e = emp(b.employee_id);
      return match(q, b.code, e?.name, e?.nip, ...itemsOf(b).map((i) => i.item_code + ' ' + i.item_name));
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const onScan = () => {
    const code = stripQrPrefix(scan);
    const it = itemByCode(code);
    const bb = borrowingByCode(code);
    const b = bb || (it && all.find((x) => detailsOf(x).some((d) => d.item_id === it.id)));
    if (b && isActive(b)) router.push(`/pengembalian/baru?pinjam=${b.id}`);
    else toast(it ? `${it.item_code} tidak sedang dipinjam (status ${it.item_status}).` : `Kode ${code} tidak ditemukan.`, 'err');
    setScan('');
  };

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/pengembalian">Pengembalian</Link> / Baru
          </>
        }
        title="Catat Pengembalian"
        desc="Langkah 1: buka transaksi aktif — cari nama/kode, atau pindai QR barang yang dikembalikan."
      />
      <section className="card">
        <div className="toolbar">
          <div className="grow">
            <Icon name="search" size={16} />
            <Input placeholder="Cari nama peminjam, kode PJM-…, atau kode barang INV-…" aria-label="Cari transaksi aktif" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input
            className="font-mono"
            placeholder="Pindai QR barang + Enter"
            aria-label="Pindai QR barang"
            style={{ width: 260 }}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onScan();
              }
            }}
          />
        </div>
        {!all.length ? (
          <Empty icon="checkCircle">Tidak ada transaksi aktif yang menunggu pengembalian.</Empty>
        ) : list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Peminjam</th>
                  <th>Barang</th>
                  <th>Batas</th>
                  <th>Sisa waktu</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((b) => {
                  const e = emp(b.employee_id);
                  return (
                    <tr key={b.id} className="clickable" onClick={(ev) => !(ev.target as HTMLElement).closest('a') && router.push(`/pengembalian/baru?pinjam=${b.id}`)}>
                      <td className="mono strong">{b.code}</td>
                      <td>
                        <div className="cell-title">{e?.name}</div>
                        <div className="cell-sub">{unit(e?.unit_id)?.name}</div>
                      </td>
                      <td className="small">
                        {itemsOf(b)
                          .map((i) => `${i.item_name} (${i.item_code})`)
                          .join(', ')}
                      </td>
                      <td className="nowrap">{fmtDate(b.due_date)}</td>
                      <td className="small nowrap">
                        <DueText b={b} />
                      </td>
                      <td className="right">
                        <Button size="sm" variant="primary" href={`/pengembalian/baru?pinjam=${b.id}`}>
                          Pilih
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="search">Tidak ada transaksi aktif yang cocok.</Empty>
        )}
      </section>
    </>
  );
}

/* ---------- Langkah 2: pemeriksaan barang ---------- */
function ReturnForm({ b }: { b: Borrowing }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const e = emp(b.employee_id);
  const v = borrowView(b);
  const items = itemsOf(b);
  const s = db.data.settings;
  const [details, setDetails] = useState<Record<ID, ReturnItemInput>>(() =>
    Object.fromEntries(items.map((it) => [it.id, { condition: '', complete: true, missing_note: '', damage_note: '' }])),
  );
  const [returnDate, setReturnDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [sendConfirm, setSendConfirm] = useState(s.return_notify);
  const [error, setError] = useState('');

  const patch = (id: ID, p: Partial<ReturnItemInput>) => setDetails((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const late = returnDate ? Math.max(0, diffDays(b.due_date, returnDate)) : 0;

  const [saving, setSaving] = useState(false);
  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const payload = Object.fromEntries(
      Object.entries(details).map(([k, d]) => [k, { ...d, complete: d.condition === 'HILANG' ? false : d.complete }]),
    ) as Record<ID, ReturnItemInput>;
    setSaving(true);
    const r = await repo.createReturn({ borrowing_id: b.id, return_date: returnDate, details: payload, notes, send_confirmation: sendConfirm });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    const changed = returnDetails(r.ret)
      .map((x) => `${getItem(x.item_id)?.item_code} → ${RETURN_CONDITIONS.find((c) => c.key === x.condition_after)?.item_status}`)
      .join(', ');
    toast(`Pengembalian ${r.ret.code} tersimpan. ${changed}.${r.notification ? ' Konfirmasi dikirim ke peminjam.' : ''}`);
    router.push(`/pengembalian/${r.ret.id}`);
  };

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/pengembalian">Pengembalian</Link> / Baru
          </>
        }
        title={`Pengembalian ${b.code}`}
        desc="Langkah 2: periksa kondisi dan kelengkapan setiap barang, lalu simpan."
        actions={
          <Button icon="refresh" href="/pengembalian/baru">
            Ganti transaksi
          </Button>
        }
      />
      <form noValidate onSubmit={onSubmit}>
        <div className="split-wide">
          <div className="stack">
            <section className="card" style={{ borderColor: v.lateDays ? '#ebc6c6' : 'var(--border)', background: v.lateDays ? '#fbf5f5' : '#fff' }}>
              <div className="card-body row between">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Avatar name={e?.name} />
                  <div>
                    <b>{e?.name}</b> <span className="mono small muted">{b.code}</span>
                    <div className="cell-sub">
                      {unit(e?.unit_id)?.name} · dipinjam {fmtDate(b.borrow_date)} · batas {fmtDate(b.due_date)}
                    </div>
                    <div className="cell-sub">Tujuan: {b.purpose}</div>
                  </div>
                </div>
                <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <BorrowBadge b={b} />
                  <span className="small">
                    <DueText b={b} />
                  </span>
                </div>
              </div>
            </section>

            <Card title={`Pemeriksaan barang (${items.length})`}>
              <div className="stack" style={{ gap: 12 }}>
                {items.map((it) => {
                  const d = details[it.id];
                  const showDamage = !!d.condition && d.condition !== 'BAIK' && d.condition !== 'HILANG';
                  const showMissing = !d.complete && d.condition !== 'HILANG';
                  return (
                    <div key={it.id} className="card" style={{ boxShadow: 'none' }}>
                      <div className="card-body stack" style={{ gap: 12 }}>
                        <div className="row between" style={{ flexWrap: 'nowrap' }}>
                          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                            <Thumb item={it} />
                            <div>
                              <b>{it.item_name}</b>
                              <div className="cell-sub mono">{it.item_code}</div>
                            </div>
                          </div>
                          <Badge status={it.item_status} />
                        </div>
                        {it.notes && (
                          <div className="small muted">
                            <Icon name="info" size={14} className="inline align-[-2px]" /> Kelengkapan saat diserahkan: {it.notes}
                          </div>
                        )}
                        <div className="form-grid">
                          <SelectField
                            label="Kondisi akhir"
                            required
                            value={d.condition}
                            onChange={(ev) => patch(it.id, { condition: ev.target.value as ReturnConditionKey })}
                            options={[{ value: '', label: '— Pilih hasil pemeriksaan —' }, ...RETURN_CONDITIONS.map((c) => ({ value: c.key, label: c.label }))]}
                          />
                          <Field label="Kelengkapan">
                            <label className="check" style={{ minHeight: 38, alignItems: 'center' }}>
                              <Checkbox checked={d.complete} disabled={d.condition === 'HILANG'} onCheckedChange={(c) => patch(it.id, { complete: c === true })} /> Lengkap sesuai saat diserahkan
                            </label>
                          </Field>
                          {showMissing && (
                            <TextField
                              full
                              label="Kelengkapan yang kurang"
                              placeholder="mis. charger tidak dikembalikan"
                              value={d.missing_note}
                              onChange={(ev) => patch(it.id, { missing_note: ev.target.value })}
                            />
                          )}
                          {showDamage && (
                            <TextareaField
                              full
                              rows={2}
                              label="Keterangan kerusakan"
                              placeholder="Jelaskan kerusakan yang ditemukan"
                              value={d.damage_note}
                              onChange={(ev) => patch(it.id, { damage_note: ev.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Data pengembalian">
              <div className="form-grid">
                <TextField
                  label="Tanggal pengembalian"
                  type="date"
                  required
                  min={b.borrow_date}
                  value={returnDate}
                  readOnly={!CAPABILITIES.returnDate}
                  hint={CAPABILITIES.returnDate ? undefined : 'Dicatat otomatis oleh server saat disimpan.'}
                  onChange={(ev) => setReturnDate(ev.target.value)}
                />
                <TextField label="Diterima oleh" value={user?.name ?? ''} readOnly />
                <TextareaField label="Catatan" full rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
                <label className="check full">
                  <Checkbox checked={sendConfirm} disabled={!s.return_notify} onCheckedChange={(c) => setSendConfirm(c === true)} />
                  <span>
                    Kirim konfirmasi pengembalian ke {e?.email}
                    {!s.return_notify && <span className="muted"> (dinonaktifkan di Pengaturan)</span>}
                  </span>
                </label>
              </div>
            </Card>
          </div>

          <div className="stack" style={{ position: 'sticky', top: 76 }}>
            <Card title="Hasil setelah disimpan">
              <ul className="list">
                {items.map((it) => {
                  const c = RETURN_CONDITIONS.find((x) => x.key === details[it.id].condition);
                  return (
                    <li key={it.id} style={{ flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 140px' }} className="small">
                        <b>{it.item_name}</b>
                      </span>
                      <Badge status="DIPINJAM" />
                      <Icon name="chev" size={14} />
                      {c ? <Badge status={c.item_status} /> : <span className="small muted">belum diperiksa</span>}
                    </li>
                  );
                })}
              </ul>
              <KV
                items={[
                  ['Status transaksi', <Badge key="s" status="DIKEMBALIKAN" />],
                  ['Keterlambatan', <LateText key="l" days={late} />],
                ]}
              />
              {error && (
                <Alert type="danger" className="mt-2.5">
                  {error}
                </Alert>
              )}
              <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                <Button type="submit" variant="primary" icon="check" block disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan Pengembalian'}
                </Button>
                <Button block href={`/peminjaman/${b.id}`}>
                  Batal
                </Button>
              </div>
              <p className={cn('small muted')} style={{ marginTop: 10 }}>
                Riwayat peminjaman tetap disimpan. Jadwal pengingat transaksi ini otomatis berhenti.
              </p>
            </Card>
          </div>
        </div>
      </form>
    </>
  );
}
