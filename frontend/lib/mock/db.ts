/**
 * Lapisan data mockup — simulasi MariaDB di localStorage browser.
 *
 * Setiap `save()` menaikkan nomor versi dan memberi tahu pelanggan (React) sehingga
 * seluruh tampilan yang membaca data ikut diperbarui. Saat integrasi production,
 * modul ini digantikan oleh Flask REST API (lihat `services/api`).
 */
import { STORAGE_KEYS } from '@/lib/constants';
import { setDayOffsetProvider } from '@/lib/date';
import { migrate } from '@/lib/mock/defaults';
import type { DbData, ID, Row, TableName } from '@/types';

export const TABLES: TableName[] = [
  'users',
  'roles',
  'oauth_accounts',
  'units',
  'employees',
  'categories',
  'locations',
  'items',
  'item_movements',
  'borrowings',
  'borrowing_details',
  'returns',
  'return_details',
  'notifications',
  'notification_logs',
  'activity_logs',
  'email_templates',
  'scheduler_runs',
  'reports_generated',
];

type Listener = () => void;

let state: DbData | null = null;
let version = 0;
let seeder: (() => void) | null = null;
const listeners = new Set<Listener>();
let onSaveError: ((msg: string) => void) | null = null;
/** Mode api: data hanya cache di memori, tidak ditulis ke localStorage. */
let persist = true;

setDayOffsetProvider(() => Number(state?.settings?.demo_offset_days || 0));

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export const db = {
  /** Data mentah. Hanya aman diakses setelah `load()`. */
  get data(): DbData {
    if (!state) throw new Error('Database belum dimuat.');
    return state;
  },
  set data(v: DbData) {
    state = v;
  },
  get ready() {
    return state !== null;
  },

  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getVersion: () => version,
  setPersist(v: boolean) {
    persist = v;
  },
  /** Ganti seluruh data (dipakai sinkronisasi dari API). */
  replace(next: DbData) {
    state = next;
    emit();
  },
  onSaveError(fn: (msg: string) => void) {
    onSaveError = fn;
  },

  /** Muat dari localStorage; bila kosong jalankan seed. Mengembalikan true bila data baru dibuat. */
  load(seed: () => void): boolean {
    seeder = seed;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.db);
    } catch {
      raw = null;
    }
    if (raw) {
      try {
        state = JSON.parse(raw) as DbData;
      } catch {
        state = null;
      }
    }
    if (!state || !state.version) {
      seed();
      emit();
      return true;
    }
    TABLES.forEach((t) => {
      if (!state![t]) (state as unknown as Record<string, unknown[]>)[t] = [];
    });
    migrate(state);
    emit();
    return false;
  },

  save(): boolean {
    if (!persist) {
      // Mode api: data transaksi berasal dari server; hanya pengaturan lokal yang disimpan di browser.
      try {
        if (state) localStorage.setItem('siipb.api.settings', JSON.stringify(state.settings));
      } catch {
        /* abaikan */
      }
      emit();
      return true;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.db, JSON.stringify(state));
      emit();
      return true;
    } catch {
      emit();
      onSaveError?.('Penyimpanan browser penuh. Kurangi foto barang atau lakukan backup lalu reset data.');
      return false;
    }
  },

  /** Kirim notifikasi perubahan tanpa menulis ke storage (mis. setelah mutasi sementara). */
  touch: emit,

  reset() {
    try {
      localStorage.removeItem(STORAGE_KEYS.db);
    } catch {
      /* abaikan */
    }
    seeder?.();
    emit();
  },

  nextId(t: TableName): number {
    const d = db.data;
    const max = (d[t] as { id: ID }[]).reduce((m, r) => Math.max(m, r.id || 0), 0);
    d._seq[t] = Math.max(d._seq[t] || 0, max) + 1;
    return d._seq[t]!;
  },
  all<T extends TableName>(t: T): Row<T>[] {
    return (db.data[t] || []) as Row<T>[];
  },
  get<T extends TableName>(t: T, id: ID | string | null | undefined): Row<T> | null {
    if (id === null || id === undefined || id === '') return null;
    return (db.all(t) as { id: ID }[]).find((r) => r.id === Number(id)) as Row<T> | undefined ?? null;
  },
  find<T extends TableName>(t: T, fn: (r: Row<T>) => boolean): Row<T> | null {
    return db.all(t).find(fn) ?? null;
  },
  where<T extends TableName>(t: T, fn: (r: Row<T>) => boolean): Row<T>[] {
    return db.all(t).filter(fn);
  },
  insert<T extends TableName>(t: T, row: Omit<Row<T>, 'id'>): Row<T> {
    const r = { id: db.nextId(t), ...row } as Row<T>;
    (db.data[t] as Row<T>[]).push(r);
    return r;
  },
  update<T extends TableName>(t: T, id: ID, patch: Partial<Row<T>>): Row<T> | null {
    const r = db.get(t, id);
    if (!r) return null;
    Object.assign(r as object, patch);
    return r;
  },
  remove<T extends TableName>(t: T, id: ID) {
    (db.data as unknown as Record<string, { id: ID }[]>)[t] = (db.data[t] as { id: ID }[]).filter((r) => r.id !== Number(id));
  },
};

export type Db = typeof db;
