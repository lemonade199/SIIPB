/** Autentikasi: login lokal, SSO (OIDC, disimulasikan), logout, ganti kata sandi. */
import { db } from '@/lib/mock/db';
import { nowISO } from '@/lib/date';
import { uid } from '@/lib/utils';
import { audit } from '@/services/audit';
import { role, user } from '@/services/lookup';
import { currentUser, setSession } from '@/services/session';
import type { ID, Result, User } from '@/types';

function b64(o: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
}

function startSession(u: User, method: string) {
  const hours = Number(db.data.settings.security.session_hours || 8);
  const exp = new Date(Date.now() + hours * 3600000).toISOString();
  const token =
    b64({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    b64({ sub: u.id, role: role(u.role_id)?.code, exp: Math.floor(Date.parse(exp) / 1000) }) +
    '.' +
    uid() +
    uid();
  setSession({ user_id: u.id, token, exp, method, started: new Date().toISOString() });
  db.update('users', u.id, { last_login: nowISO() });
  audit('auth.login', 'users', u.id, null, { metode: method }, u.id);
  db.save();
}

export function login(username: string, password: string): Result<{ user: User }> {
  const key = String(username || '').trim().toLowerCase();
  const u = db.find('users', (x) => x.username.toLowerCase() === key || x.email.toLowerCase() === key);
  if (!u || u.password !== password) return { ok: false, error: 'Username/email atau kata sandi salah.' };
  if (!u.active) return { ok: false, error: 'Akun dinonaktifkan. Hubungi administrator.' };
  startSession(u, 'LOKAL');
  return { ok: true, user: u };
}

export function loginSSO(userId: ID): Result<{ user: User }> {
  const u = user(userId);
  if (!u || !u.active) return { ok: false, error: 'Akun SSO tidak terhubung ke pengguna aktif.' };
  startSession(u, 'SSO (OIDC)');
  return { ok: true, user: u };
}

export function logout() {
  const u = currentUser();
  if (u) {
    audit('auth.logout', 'users', u.id, null, null, u.id);
    db.save();
  }
  setSession(null);
  db.touch();
}

export function changePassword(u: User, oldPw: string, next: string, confirm: string) {
  const errors: Record<string, string> = {};
  if (oldPw !== u.password) errors.old = 'Kata sandi lama salah.';
  if (next.length < 8) errors.new1 = 'Minimal 8 karakter.';
  if (next !== confirm) errors.new2 = 'Tidak sama dengan kata sandi baru.';
  if (Object.keys(errors).length) return { ok: false as const, errors };
  u.password = next;
  audit('user.password', 'users', u.id, null, { kata_sandi: 'diubah' });
  db.save();
  return { ok: true as const };
}
