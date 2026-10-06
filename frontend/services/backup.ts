/** Backup & pemulihan (mockup: seluruh data dalam JSON). */
import { db, TABLES } from '@/lib/mock/db';
import { clone } from '@/lib/utils';
import { audit } from '@/services/audit';
import { currentUser } from '@/services/session';
import type { DbData } from '@/types';

export function backupJSON() {
  const payload = clone(db.data) as DbData & { backup_meta?: unknown };
  payload.backup_meta = { app: 'SIIPB', created_at: new Date().toISOString(), by: currentUser()?.username };
  return JSON.stringify(payload, null, 1);
}

export function restoreJSON(text: string) {
  let obj: (DbData & { backup_meta?: unknown }) | null;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false as const, error: 'Berkas bukan JSON yang valid.' };
  }
  if (!obj || !obj.version || !Array.isArray(obj.items) || !Array.isArray(obj.users) || !obj.settings)
    return { ok: false as const, error: 'Struktur berkas tidak sesuai backup SIIPB.' };
  delete obj.backup_meta;
  db.data = obj;
  TABLES.forEach((t) => {
    if (!db.data[t]) (db.data as unknown as Record<string, unknown[]>)[t] = [];
  });
  audit('backup.restore', 'settings', null, null, { item: obj.items.length, transaksi: obj.borrowings.length });
  db.save();
  return { ok: true as const };
}
