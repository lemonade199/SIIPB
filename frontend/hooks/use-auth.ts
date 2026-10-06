'use client';

import { useDbVersion } from '@/hooks/use-db';
import { can, currentUser, getSession } from '@/services/session';
import { role } from '@/services/lookup';
import type { PermissionKey } from '@/types';

/** Pengguna yang sedang login + helper RBAC. */
export function useAuth() {
  useDbVersion();
  const user = currentUser();
  const r = user ? role(user.role_id) : null;
  return {
    user,
    role: r,
    session: getSession(),
    can: (perm: PermissionKey) => can(perm, user),
  };
}

/** Versi ringkas — mengembalikan fungsi `can`. */
export function useCan() {
  return useAuth().can;
}
