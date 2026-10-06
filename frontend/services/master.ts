/** Master data: peminjam/pegawai, kategori, lokasi, unit kerja. */
import { db } from '@/lib/mock/db';
import { clone, EMAIL_RE } from '@/lib/utils';
import { audit } from '@/services/audit';
import { activeBorrowings } from '@/services/lookup';
import type { FieldErrors, ID } from '@/types';

export type MasterKey = 'peminjam' | 'kategori' | 'lokasi' | 'unit';
export type MasterTable = 'employees' | 'categories' | 'locations' | 'units';
export type MasterForm = Record<string, string>;

interface MasterDef {
  table: MasterTable;
  noun: string;
  validate: (d: MasterForm, id: ID | null) => FieldErrors;
  map: (d: MasterForm) => Record<string, unknown>;
  used: (id: ID) => boolean;
}

const t = (v: string | undefined) => (v || '').trim();

export const MASTER: Record<MasterKey, MasterDef> = {
  peminjam: {
    table: 'employees',
    noun: 'peminjam',
    validate: (d, id) => {
      const e: FieldErrors = {};
      if (!t(d.nip)) e.nip = 'Wajib diisi.';
      else if (db.find('employees', (x) => x.nip === t(d.nip) && x.id !== id)) e.nip = 'NIP sudah terdaftar.';
      if (!t(d.name)) e.name = 'Wajib diisi.';
      if (!d.unit_id) e.unit_id = 'Pilih unit kerja.';
      if (!EMAIL_RE.test(t(d.email))) e.email = 'Format email tidak valid.';
      return e;
    },
    map: (d) => ({ nip: t(d.nip), name: t(d.name), unit_id: Number(d.unit_id), position: t(d.position), email: t(d.email), phone: t(d.phone) }),
    used: (id) => !!db.find('borrowings', (b) => b.employee_id === id),
  },
  kategori: {
    table: 'categories',
    noun: 'kategori',
    validate: (d, id) => {
      const e: FieldErrors = {};
      if (!/^[A-Za-z]{2,5}$/.test(t(d.code))) e.code = '2–5 huruf.';
      else if (db.find('categories', (x) => x.code.toUpperCase() === t(d.code).toUpperCase() && x.id !== id)) e.code = 'Kode sudah dipakai.';
      if (!t(d.name)) e.name = 'Wajib diisi.';
      return e;
    },
    map: (d) => ({ code: t(d.code).toUpperCase(), name: t(d.name) }),
    used: (id) => !!db.find('items', (i) => i.category_id === id),
  },
  lokasi: {
    table: 'locations',
    noun: 'lokasi',
    validate: (d, id) => {
      const e: FieldErrors = {};
      if (!t(d.code)) e.code = 'Wajib diisi.';
      else if (db.find('locations', (x) => x.code.toUpperCase() === t(d.code).toUpperCase() && x.id !== id)) e.code = 'Kode sudah dipakai.';
      if (!t(d.name)) e.name = 'Wajib diisi.';
      return e;
    },
    map: (d) => ({ code: t(d.code).toUpperCase(), name: t(d.name), building: t(d.building) }),
    used: (id) => !!db.find('items', (i) => i.location_id === id),
  },
  unit: {
    table: 'units',
    noun: 'unit kerja',
    validate: (d, id) => {
      const e: FieldErrors = {};
      if (!t(d.name)) e.name = 'Wajib diisi.';
      else if (db.find('units', (x) => x.name.toLowerCase() === t(d.name).toLowerCase() && x.id !== id)) e.name = 'Sudah ada.';
      return e;
    },
    map: (d) => ({ name: t(d.name) }),
    used: (id) => !!db.find('employees', (e) => e.unit_id === id),
  },
};

type AnyRow = { id: ID; active: boolean; name: string };
const rowOf = (table: MasterTable, id: ID) => db.get(table, id) as unknown as AnyRow | null;

export function saveMaster(key: MasterKey, form: MasterForm, id: ID | null) {
  const D = MASTER[key];
  const errors = D.validate(form, id);
  if (Object.keys(errors).length) return { ok: false as const, errors };
  const data = D.map(form);
  if (id) {
    const old = clone(rowOf(D.table, id));
    db.update(D.table, id, data as never);
    audit(`${D.table}.update`, D.table, id, old as unknown as Record<string, unknown>, data);
  } else {
    const r = db.insert(D.table, { active: true, ...data } as never) as unknown as AnyRow;
    audit(`${D.table}.create`, D.table, r.id, null, data);
  }
  db.save();
  return { ok: true as const };
}

export function setMasterActive(key: MasterKey, id: ID, active: boolean) {
  const D = MASTER[key];
  const r = rowOf(D.table, id);
  if (!r) return { ok: false as const, error: 'Data tidak ditemukan.' };
  if (!active && key === 'peminjam' && activeBorrowings().some((b) => b.employee_id === id))
    return { ok: false as const, error: 'Peminjam masih memiliki pinjaman aktif.' };
  r.active = active;
  audit(`${D.table}.${active ? 'activate' : 'deactivate'}`, D.table, id, { aktif: !active }, { aktif: active });
  db.save();
  return { ok: true as const };
}

export function deleteMaster(key: MasterKey, id: ID) {
  const D = MASTER[key];
  const r = rowOf(D.table, id);
  if (!r) return { ok: false as const, error: 'Data tidak ditemukan.' };
  if (D.used(id)) return { ok: false as const, error: 'Data sudah dipakai sehingga tidak dapat dihapus. Gunakan nonaktifkan.' };
  db.remove(D.table, id);
  audit(`${D.table}.delete`, D.table, id, { nama: r.name }, null);
  db.save();
  return { ok: true as const };
}
