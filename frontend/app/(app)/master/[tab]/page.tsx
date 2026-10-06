'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { db } from '@/lib/mock/db';
import { relDue } from '@/lib/date';
import { cn, match } from '@/lib/utils';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { SelectField, TextField, toOptions } from '@/components/ui/form';
import { Icon, type IconName } from '@/components/ui/icon';
import { Alert, Empty, PageHead, SearchInput } from '@/components/ui/misc';
import { useConfirm, useToast } from '@/components/providers/feedback-provider';
import { activeBorrowings, unit } from '@/services/lookup';
import { deleteMaster, MASTER, saveMaster, setMasterActive, type MasterForm, type MasterKey } from '@/services/master';
import type { Category, Employee, FieldErrors, ID, Location, Unit } from '@/types';

type AnyRow = Employee | Category | Location | Unit;

interface ViewDef {
  label: string;
  icon: IconName;
  desc: string;
  cols: string[];
  row: (r: AnyRow) => ReactNode[];
  search: (r: AnyRow) => unknown[];
  blank: MasterForm;
  toForm: (r: AnyRow) => MasterForm;
  form: (v: MasterForm, set: (k: string, val: string) => void, err: FieldErrors, existing: AnyRow | null) => ReactNode;
}

const VIEWS: Record<MasterKey, ViewDef> = {
  peminjam: {
    label: 'Peminjam / Pegawai',
    icon: 'users',
    desc: 'Peminjam tidak memiliki akun dan tidak login. Data ini dipakai petugas untuk memilih peminjam dan sebagai alamat email notifikasi.',
    cols: ['NIP', 'Nama', 'Unit kerja', 'Email notifikasi', 'Telepon', 'Pinjaman aktif'],
    row: (r) => {
      const e = r as Employee;
      const act = activeBorrowings().filter((b) => b.employee_id === e.id);
      const late = act.filter((b) => relDue(b.due_date).n < 0).length;
      return [
        <span key="n" className="mono">{e.nip}</span>,
        <div key="m">
          <b>{e.name}</b>
          <div className="cell-sub">{e.position}</div>
        </div>,
        unit(e.unit_id)?.name,
        e.email,
        e.phone,
        act.length ? (
          <span key="a">
            {act.length} transaksi {late > 0 && <span className="badge b-late">{late} terlambat</span>}
          </span>
        ) : (
          <span key="a" className="muted">—</span>
        ),
      ];
    },
    search: (r) => {
      const e = r as Employee;
      return [e.nip, e.name, e.email, unit(e.unit_id)?.name];
    },
    blank: { nip: '', name: '', unit_id: '', position: 'Staf', email: '', phone: '' },
    toForm: (r) => {
      const e = r as Employee;
      return { nip: e.nip, name: e.name, unit_id: String(e.unit_id), position: e.position, email: e.email, phone: e.phone };
    },
    form: (v, set, err, existing) => (
      <div className="form-grid">
        <TextField label="NIP / nomor induk" required mono value={v.nip} error={err.nip} onChange={(e) => set('nip', e.target.value)} />
        <TextField label="Nama lengkap" required value={v.name} error={err.name} onChange={(e) => set('name', e.target.value)} />
        <SelectField
          label="Unit kerja"
          required
          value={v.unit_id}
          error={err.unit_id}
          onChange={(e) => set('unit_id', e.target.value)}
          options={toOptions(db.where('units', (u) => u.active || u.id === (existing as Employee | null)?.unit_id))}
        />
        <TextField label="Jabatan" value={v.position} onChange={(e) => set('position', e.target.value)} />
        <TextField
          label="Email"
          type="email"
          required
          value={v.email}
          error={err.email}
          hint="Wajib — tujuan notifikasi peminjaman dan pengingat."
          onChange={(e) => set('email', e.target.value)}
        />
        <TextField label="No. telepon" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
    ),
  },
  kategori: {
    label: 'Kategori',
    icon: 'tag',
    desc: 'Kategori menentukan prefiks kode barang otomatis (INV-[KODE]-0001).',
    cols: ['Kode', 'Nama kategori', 'Jumlah barang'],
    row: (r) => {
      const c = r as Category;
      return [<span key="c" className="mono strong">{c.code}</span>, c.name, String(db.where('items', (i) => i.category_id === c.id && i.active).length)];
    },
    search: (r) => [(r as Category).code, r.name],
    blank: { code: '', name: '' },
    toForm: (r) => ({ code: (r as Category).code, name: r.name }),
    form: (v, set, err) => (
      <div className="form-grid">
        <TextField label="Kode (3 huruf)" required mono maxLength={5} style={{ textTransform: 'uppercase' }} value={v.code} error={err.code} onChange={(e) => set('code', e.target.value)} />
        <TextField label="Nama kategori" required value={v.name} error={err.name} onChange={(e) => set('name', e.target.value)} />
      </div>
    ),
  },
  lokasi: {
    label: 'Lokasi',
    icon: 'map',
    desc: 'Tempat penyimpanan barang. Perpindahan lokasi tercatat pada riwayat barang.',
    cols: ['Kode', 'Nama lokasi', 'Gedung / lantai', 'Jumlah barang'],
    row: (r) => {
      const l = r as Location;
      return [<span key="c" className="mono strong">{l.code}</span>, l.name, l.building, String(db.where('items', (i) => i.location_id === l.id && i.active).length)];
    },
    search: (r) => [(r as Location).code, r.name, (r as Location).building],
    blank: { code: '', name: '', building: '' },
    toForm: (r) => ({ code: (r as Location).code, name: r.name, building: (r as Location).building }),
    form: (v, set, err) => (
      <div className="form-grid">
        <TextField label="Kode" required mono value={v.code} error={err.code} onChange={(e) => set('code', e.target.value)} />
        <TextField label="Nama lokasi" required value={v.name} error={err.name} onChange={(e) => set('name', e.target.value)} />
        <TextField label="Gedung / lantai" full value={v.building} onChange={(e) => set('building', e.target.value)} />
      </div>
    ),
  },
  unit: {
    label: 'Unit Kerja',
    icon: 'building',
    desc: 'Unit kerja peminjam, dipakai untuk filter monitoring dan laporan.',
    cols: ['Nama unit kerja', 'Jumlah pegawai'],
    row: (r) => [r.name, String(db.where('employees', (e) => e.unit_id === r.id && e.active).length)],
    search: (r) => [r.name],
    blank: { name: '' },
    toForm: (r) => ({ name: r.name }),
    form: (v, set, err) => <TextField label="Nama unit kerja" required value={v.name} error={err.name} onChange={(e) => set('name', e.target.value)} />,
  },
};

export default function MasterPage() {
  const params = useParams<{ tab: string }>();
  const key: MasterKey = params.tab in VIEWS ? (params.tab as MasterKey) : 'peminjam';
  useTitle('Master Data');
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = usePersistentState('md.filter', { q: '', inactive: false });
  const [editing, setEditing] = useState<{ row: AnyRow | null; form: MasterForm } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const V = VIEWS[key];
  const D = MASTER[key];
  const rows = (db.all(D.table) as AnyRow[]).filter((r) => (f.inactive ? !r.active : r.active) && match(f.q, ...V.search(r)));

  const openForm = (row: AnyRow | null) => {
    setErrors({});
    setEditing({ row, form: row ? V.toForm(row) : { ...V.blank } });
  };
  const save = () => {
    if (!editing) return;
    const r = saveMaster(key, editing.form, editing.row?.id ?? null);
    if (!r.ok) return setErrors(r.errors);
    setEditing(null);
    toast(`Data ${D.noun} disimpan.`);
  };
  const deactivate = async (r: AnyRow) => {
    if (key === 'peminjam' && activeBorrowings().some((b) => b.employee_id === r.id)) return toast('Peminjam masih memiliki pinjaman aktif.', 'err');
    const ok = await confirm({ title: `Nonaktifkan ${D.noun}?`, message: `${r.name} tidak akan muncul sebagai pilihan baru. Data lama tetap tersimpan.`, confirmText: 'Nonaktifkan', danger: true });
    if (!ok) return;
    const res = setMasterActive(key, r.id, false);
    if (!res.ok) toast(res.error, 'err');
  };
  const remove = async (r: AnyRow) => {
    const ok = await confirm({ title: `Hapus ${D.noun}?`, message: `${r.name} belum pernah dipakai sehingga dapat dihapus permanen.`, confirmText: 'Hapus', danger: true });
    if (!ok) return;
    const res = deleteMaster(key, r.id as ID);
    if (!res.ok) return toast(res.error, 'err');
    toast('Data dihapus.');
  };

  return (
    <>
      <PageHead
        crumb="Beranda / Master Data"
        title="Master Data"
        desc="Data referensi untuk inventaris dan transaksi."
        actions={
          <Button variant="primary" icon="plus" onClick={() => openForm(null)}>
            Tambah {D.noun}
          </Button>
        }
      />
      <section className="card">
        <nav className="tabs" style={{ padding: '0 12px' }} aria-label="Jenis master data">
          {(Object.keys(VIEWS) as MasterKey[]).map((k) => (
            <Link key={k} href={`/master/${k}`} className={cn(k === key && 'active')} aria-current={k === key ? 'page' : undefined}>
              <Icon name={VIEWS[k].icon} size={16} /> {VIEWS[k].label}{' '}
              <span className="pill">{(db.all(MASTER[k].table) as AnyRow[]).filter((r) => r.active).length}</span>
            </Link>
          ))}
        </nav>
        <div style={{ padding: '14px 20px 0' }}>
          <Alert type="info">{V.desc}</Alert>
        </div>
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(v) => setF((p) => ({ ...p, q: v }))} placeholder={`Cari ${D.noun}…`} label="Cari" />
          <label className="check small">
            <input type="checkbox" checked={f.inactive} onChange={(e) => setF((p) => ({ ...p, inactive: e.target.checked }))} /> Tampilkan nonaktif
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {V.cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id}>
                    {V.row(r).map((c, i) => (
                      <td key={i}>{c}</td>
                    ))}
                    <td className="right nowrap">
                      <Button size="sm" iconOnly icon="pencil" title="Ubah" onClick={() => openForm(r)} />{' '}
                      {r.active ? (
                        <Button size="sm" iconOnly icon="archive" title="Nonaktifkan" onClick={() => deactivate(r)} />
                      ) : (
                        <Button size="sm" onClick={() => setMasterActive(key, r.id, true)}>
                          Aktifkan
                        </Button>
                      )}{' '}
                      {!D.used(r.id) && <Button size="sm" iconOnly icon="trash" variant="danger" title="Hapus (belum pernah dipakai)" onClick={() => remove(r)} />}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={V.cols.length + 1}>
                    <Empty icon={V.icon}>Tidak ada data {D.noun}.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`${editing?.row ? 'Ubah' : 'Tambah'} ${D.noun}`}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Batal</Button>
            <Button variant="primary" icon="check" onClick={save}>
              Simpan
            </Button>
          </>
        }
      >
        {editing && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {V.form(editing.form, (k, val) => setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: val } } : s)), errors, editing.row)}
          </form>
        )}
      </Modal>
    </>
  );
}
