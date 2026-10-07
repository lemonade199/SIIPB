'use client';

import { useState } from 'react';
import { CAPABILITIES } from '@/lib/config';
import { db } from '@/lib/mock/db';
import { fmtDateTime } from '@/lib/date';
import { PERMISSIONS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Checkbox, SelectField, Switch, TextareaField, TextField } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Alert, Avatar, PageHead, Tabs } from '@/components/ui/misc';
import { useConfirm, useToast } from '@/components/providers/feedback-provider';
import { role } from '@/services/lookup';
import { type UserInput } from '@/services/users';
import * as repo from '@/services/repo';
import type { FieldErrors, LoginMethod, Role, User } from '@/types';

type Tab = 'users' | 'roles';

export default function PenggunaPage() {
  useTitle('Pengguna & Role');
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = usePersistentState<Tab>('us.tab', 'users');
  const [userForm, setUserForm] = useState<{ existing: User | null; v: UserInput } | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; description: string } | null>(null);
  const [tempPw, setTempPw] = useState<{ name: string; pw: string } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  if (!me) return null;

  const users = db.all('users');
  const roles = db.all('roles');
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];

  const openUser = (u: User | null) => {
    setErrors({});
    setUserForm({
      existing: u,
      v: u
        ? { name: u.name, username: u.username, email: u.email, phone: u.phone, role_id: u.role_id, login_method: u.login_method, active: u.active }
        : { name: '', username: '', email: '', phone: '', role_id: 2, login_method: 'LOKAL', password: '', active: true },
    });
  };
  const setU = <K extends keyof UserInput>(k: K, val: UserInput[K]) => setUserForm((s) => (s ? { ...s, v: { ...s.v, [k]: val } } : s));
  const saveU = async () => {
    if (!userForm) return;
    const r = await repo.saveUser(userForm.v, userForm.existing, me.id);
    if (!r.ok) return setErrors(r.errors);
    setUserForm(null);
    toast('Data pengguna disimpan.');
  };
  const onReset = async (u: User) => {
    const ok = await confirm({ title: 'Reset kata sandi?', message: `Kata sandi sementara untuk ${u.name} akan dibuat dan ditampilkan sekali.`, confirmText: 'Reset' });
    if (!ok) return;
    const pw = await repo.resetPassword(u.id);
    if (pw) setTempPw({ name: u.name, pw });
    else toast('Reset kata sandi gagal.', 'err');
  };
  const saveRole = async () => {
    if (!roleForm) return;
    const r = await repo.createRole(roleForm.name, roleForm.description);
    if (!r.ok) return setErrors(r.errors);
    setRoleForm(null);
    toast('Role ditambahkan. Atur permission-nya pada matriks.');
  };

  return (
    <>
      <PageHead
        crumb="Beranda / Administrasi"
        title="Pengguna & Role"
        desc="Pengguna internal dan hak aksesnya. Peminjam bukan pengguna sistem."
        actions={
          !CAPABILITIES.userAdmin ? undefined : tab === 'users' ? (
            <Button variant="primary" icon="plus" onClick={() => openUser(null)}>
              Tambah pengguna
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                setErrors({});
                setRoleForm({ name: '', description: '' });
              }}
            >
              Tambah role
            </Button>
          )
        }
      />
      <section className="card">
        <Tabs
          value={tab}
          onChange={setTab}
          label="Pengguna dan role"
          tabs={[
            { key: 'users', label: 'Pengguna internal', count: users.length },
            { key: 'roles', label: 'Role & permission', count: roles.length },
          ]}
        />
        {tab === 'users' ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Login</th>
                  <th>SSO</th>
                  <th>Status</th>
                  <th>Login terakhir</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const sso = db.find('oauth_accounts', (a) => a.user_id === u.id);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <Avatar name={u.name} />
                          <div>
                            <div className="cell-title">
                              {u.name} {u.id === me.id && <Tag>Anda</Tag>}
                            </div>
                            <div className="cell-sub">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{u.username}</td>
                      <td>{role(u.role_id)?.name}</td>
                      <td className="small">{u.login_method}</td>
                      <td className="small">
                        {sso ? (
                          <>
                            <Icon name="check" size={14} className="inline align-[-2px]" /> tertaut
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <Badge status={u.active ? 'AKTIF' : 'NONAKTIF'} />
                      </td>
                      <td className="small nowrap">{fmtDateTime(u.last_login)}</td>
                      <td className="right nowrap">
                        {CAPABILITIES.userAdmin && (
                          <>
                            <Button size="sm" iconOnly icon="pencil" title="Ubah" onClick={() => openUser(u)} />{' '}
                            <Button size="sm" iconOnly icon="key" title="Reset kata sandi" onClick={() => onReset(u)} />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px' }}>
              <Alert type="info">
                RBAC diterapkan di API (dekorator per endpoint) dan di antarmuka (menu &amp; tombol). Perubahan langsung berlaku dan tercatat di audit log. Role Administrator selalu memiliki
                seluruh permission.
              </Alert>
            </div>
            <div className="row" style={{ padding: '0 20px 14px', gap: 16 }}>
              {roles.map((r) => (
                <div key={r.id} className="small">
                  <b>{r.name}</b> — <span className="muted">{r.description}</span>
                </div>
              ))}
            </div>
            <div className="table-wrap">
              <table className="table matrix">
                <thead>
                  <tr>
                    <th>Permission</th>
                    {roles.map((r) => (
                      <th key={r.id}>{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <GroupRows key={g} group={g} roles={roles} onToggle={(roleName, granted, permKey) => toast(`${roleName}: ${granted ? 'diberi' : 'dicabut'} izin ${permKey}.`)} onError={(m) => toast(m, 'err')} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Modal
        open={!!userForm}
        onClose={() => setUserForm(null)}
        title={userForm?.existing ? 'Ubah pengguna' : 'Tambah pengguna'}
        desc="Pengguna internal: administrator, petugas, atau pimpinan."
        footer={
          <>
            <Button onClick={() => setUserForm(null)}>Batal</Button>
            <Button variant="primary" icon="check" onClick={saveU}>
              Simpan
            </Button>
          </>
        }
      >
        {userForm && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveU();
            }}
          >
            <div className="form-grid">
              <TextField label="Nama lengkap" required value={userForm.v.name} error={errors.name} onChange={(e) => setU('name', e.target.value)} />
              <TextField label="Username" required mono value={userForm.v.username} error={errors.username} onChange={(e) => setU('username', e.target.value)} />
              <TextField label="Email" type="email" required value={userForm.v.email} error={errors.email} onChange={(e) => setU('email', e.target.value)} />
              <TextField label="Telepon / ext." value={userForm.v.phone} onChange={(e) => setU('phone', e.target.value)} />
              <SelectField label="Role" required value={userForm.v.role_id} onChange={(e) => setU('role_id', e.target.value)} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
              <SelectField
                label="Metode login"
                value={userForm.v.login_method}
                onChange={(e) => setU('login_method', e.target.value as LoginMethod)}
                options={['LOKAL', 'SSO', 'LOKAL + SSO'].map((x) => ({ value: x, label: x }))}
              />
              {!userForm.existing && (
                <TextField
                  label="Kata sandi awal"
                  type="password"
                  required
                  hint="Minimal 8 karakter. Pengguna dapat menggantinya di Profil."
                  value={userForm.v.password}
                  error={errors.password}
                  onChange={(e) => setU('password', e.target.value)}
                />
              )}
              <label className="check full">
                <Checkbox checked={userForm.v.active} disabled={userForm.existing?.id === me.id} onCheckedChange={(c) => setU('active', c === true)} />{' '}
                Akun aktif
              </label>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!roleForm}
        onClose={() => setRoleForm(null)}
        title="Tambah role"
        footer={
          <>
            <Button onClick={() => setRoleForm(null)}>Batal</Button>
            <Button variant="primary" onClick={saveRole}>
              Simpan
            </Button>
          </>
        }
      >
        {roleForm && (
          <div className="stack" style={{ gap: 12 }}>
            <TextField label="Nama role" required value={roleForm.name} error={errors.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
            <TextareaField label="Deskripsi" rows={2} value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!tempPw}
        onClose={() => setTempPw(null)}
        title="Kata sandi sementara"
        footer={
          <Button variant="primary" onClick={() => setTempPw(null)}>
            Tutup
          </Button>
        }
      >
        <p>Sampaikan kata sandi ini kepada {tempPw?.name} melalui kanal yang aman:</p>
        <div className="code-block" style={{ fontSize: 16, marginTop: 10 }}>
          {tempPw?.pw}
        </div>
      </Modal>
    </>
  );
}

function GroupRows({
  group,
  roles,
  onToggle,
  onError,
}: {
  group: string;
  roles: Role[];
  onToggle: (roleName: string, granted: boolean, permKey: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} style={{ background: '#f9fafb', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted-foreground)' }}>
          {group}
        </td>
      </tr>
      {PERMISSIONS.filter((p) => p.group === group).map((p) => (
        <tr key={p.key}>
          <td>
            <div>{p.label}</div>
            <div className="cell-sub mono">{p.key}</div>
          </td>
          {roles.map((r) => (
            <td key={r.id}>
              <Switch
                title={`${r.name}: ${p.label}`}
                aria-label={`${r.name} — ${p.label}`}
                checked={r.permissions.includes(p.key)}
                disabled={r.code === 'admin' || !CAPABILITIES.userAdmin}
                onCheckedChange={async (c) => {
                  const res = await repo.setRolePermission(r.id, p.key, c);
                  if (res.ok) onToggle(r.name, c, p.key);
                  else onError(res.error);
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
