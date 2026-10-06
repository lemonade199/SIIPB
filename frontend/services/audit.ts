/** Audit log — append-only (siapa, kapan, tindakan, data lama, data baru). */
import { db } from '@/lib/mock/db';
import { nowISO } from '@/lib/date';
import { currentUser } from '@/services/session';
import type { AuditValue, ID } from '@/types';

export function audit(
  action: string,
  entity: string,
  entityId: ID | null,
  oldValue?: AuditValue,
  newValue?: AuditValue,
  userId?: ID,
  at?: string,
) {
  const u = userId !== undefined ? userId : currentUser()?.id;
  db.insert('activity_logs', {
    at: at || nowISO(),
    user_id: u === undefined ? 0 : u,
    action,
    entity,
    entity_id: entityId,
    old_value: oldValue === undefined ? null : oldValue,
    new_value: newValue === undefined ? null : newValue,
    ip: u === 0 ? '—' : '10.10.2.14',
  });
}
