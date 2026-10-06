'use client';

import { useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDateTime } from '@/lib/date';
import { PERMISSIONS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Avatar, KV, PageHead } from '@/components/ui/misc';
import { useToast } from '@/components/providers/feedback-provider';
import { changePassword } from '@/services/auth';

export default function ProfilPage() {
  useTitle('Profil');
  const { user, role, session } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ old: '', new1: '', new2: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!user || !role) return null;

  const sso = db.find('oauth_accounts', (a) => a.user_id === user.id);
  const perms = PERMISSIONS.filter((p) => role.permissions.includes(p.key));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = changePassword(user, pw.old, pw.new1, pw.new2);
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    setPw({ old: '', new1: '', new2: '' });
    toast('Kata sandi berhasil diubah.');
  };

  return (
    <>
      <PageHead title="Profil Saya" desc="Informasi akun, hak akses, dan sesi aktif." />
      <div className="split">
        <div className="stack">
          <Card title="Akun">
            <div className="row" style={{ marginBottom: 12 }}>
              <Avatar name={user.name} />
              <div>
                <div className="strong">{user.name}</div>
                <div className="muted small">{user.email}</div>
              </div>
            </div>
            <KV
              items={[
                ['Username', <span key="u" className="mono">{user.username}</span>],
                ['Role', role.name],
                ['Metode login', user.login_method],
                ['Login terakhir', fmtDateTime(user.last_login)],
                ['Akun SSO', sso ? `${sso.provider} · ${sso.email}` : 'Belum ditautkan'],
              ]}
            />
          </Card>
          <Card title="Hak akses (RBAC)" desc={`${perms.length} permission dari role ${role.name}`}>
            <ul className="list">
              {perms.map((p) => (
                <li key={p.key}>
                  <Icon name="check" size={16} />
                  <span>{p.label}</span>
                  <span className="mono small muted" style={{ marginLeft: 'auto' }}>
                    {p.key}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="stack">
          {session && (
            <Card title="Sesi aktif">
              <KV
                one
                items={[
                  ['Metode', session.method],
                  ['Mulai', fmtDateTime(session.started)],
                  ['Berakhir', fmtDateTime(session.exp)],
                ]}
              />
              <div className="label" style={{ margin: '12px 0 6px' }}>
                Access token (JWT)
              </div>
              <div className="code-block">{session.token}</div>
            </Card>
          )}
          <Card title="Ganti kata sandi" desc="Untuk login lokal. Di backend, kata sandi disimpan dalam bentuk hash.">
            <form className="stack" style={{ gap: 12 }} noValidate onSubmit={onSubmit}>
              <TextField label="Kata sandi lama" type="password" required value={pw.old} error={errors.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
              <TextField
                label="Kata sandi baru"
                type="password"
                required
                hint="Minimal 8 karakter."
                value={pw.new1}
                error={errors.new1}
                onChange={(e) => setPw({ ...pw, new1: e.target.value })}
              />
              <TextField label="Ulangi kata sandi baru" type="password" required value={pw.new2} error={errors.new2} onChange={(e) => setPw({ ...pw, new2: e.target.value })} />
              <div>
                <Button type="submit" variant="primary">
                  Simpan kata sandi
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
