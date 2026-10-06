/** Sesi pengguna & otorisasi (JWT disimulasikan di mockup). */
import { STORAGE_KEYS } from '@/lib/constants';
import { role, user } from '@/services/lookup';
import type { PermissionKey, Session, User } from '@/types';

export function getSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null') as Session | null;
    if (!s) return null;
    if (new Date(s.exp).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEYS.session);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    /* abaikan */
  }
}

export function currentUser(): User | null {
  const s = getSession();
  if (!s) return null;
  const u = user(s.user_id);
  return u && u.active ? u : null;
}

export function can(perm: PermissionKey, u: User | null = currentUser()): boolean {
  if (!u) return false;
  const r = role(u.role_id);
  return !!r && r.permissions.includes(perm);
}

export const roleCode = (u: User | null | undefined) => (u ? role(u.role_id)?.code : undefined);
