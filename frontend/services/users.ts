/** Pengguna internal & role/permission (RBAC). */
import { db } from '@/lib/mock/db';
import { nowISO } from '@/lib/date';
import { EMAIL_RE, uid } from '@/lib/utils';
import { audit } from '@/services/audit';
import { role, user } from '@/services/lookup';
import type { FieldErrors, ID, LoginMethod, PermissionKey, User } from '@/types';

export interface UserInput {
  name: string;
  username: string;
  email: string;
  phone: string;
  role_id: string | number;
  login_method: LoginMethod;
  password?: string;
  active: boolean;
}

export function saveUser(d: UserInput, existing: User | null, actorId: ID) {
  const err: FieldErrors = {};
  if (!d.name.trim()) err.name = 'Wajib diisi.';
  if (!/^[a-z0-9._-]{3,}$/i.test(d.username.trim())) err.username = 'Minimal 3 karakter (huruf, angka, . _ -).';
  else if (db.find('users', (x) => x.username.toLowerCase() === d.username.trim().toLowerCase() && (!existing || x.id !== existing.id)))
    err.username = 'Username sudah dipakai.';
  if (!EMAIL_RE.test(d.email.trim())) err.email = 'Email tidak valid.';
  if (!existing && (d.password || '').length < 8) err.password = 'Minimal 8 karakter.';
  if (Object.keys(err).length) return { ok: false as const, errors: err };

  const isSelf = !!existing && existing.id === actorId;
  const data = {
    name: d.name.trim(),
    username: d.username.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    role_id: Number(d.role_id),
    login_method: d.login_method,
    active: isSelf ? true : d.active,
  };
  if (existing) {
    const old = { role: role(existing.role_id)?.name, aktif: existing.active };
    db.update('users', existing.id, data);
    audit('user.update', 'users', existing.id, old, { role: role(data.role_id)?.name, aktif: data.active });
  } else {
    const r = db.insert('users', { ...data, password: d.password || '', last_login: null, created_at: nowISO() });
    audit('user.create', 'users', r.id, null, { username: r.username, role: role(r.role_id)?.name });
  }
  db.save();
  return { ok: true as const };
}

export function resetPassword(id: ID) {
  const u = user(id);
  if (!u) return null;
  const pw = 'Siipb-' + uid().slice(0, 6);
  u.password = pw;
  audit('user.reset_password', 'users', u.id, null, { kata_sandi: 'direset' });
  db.save();
  return pw;
}

export function createRole(name: string, description: string) {
  if (!name.trim()) return { ok: false as const, errors: { name: 'Wajib diisi.' } };
  const r = db.insert('roles', {
    code: name.trim().toLowerCase().replace(/\W+/g, '_'),
    name: name.trim(),
    description: description.trim(),
    permissions: ['dashboard.view'],
    system: false,
  });
  audit('role.create', 'roles', r.id, null, { nama: r.name });
  db.save();
  return { ok: true as const };
}

export function setRolePermission(roleId: ID, perm: PermissionKey, granted: boolean) {
  const r = role(roleId);
  if (!r || r.code === 'admin') return;
  r.permissions = granted ? [...new Set([...r.permissions, perm])] : r.permissions.filter((x) => x !== perm);
  audit('role.update', 'roles', r.id, { permission: (granted ? '-' : '+') + perm }, { permission: (granted ? '+' : '-') + perm });
  db.save();
}
