'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/mock/db';
import { homeFor } from '@/lib/navigation';
import { uid } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/form';
import { Icon, type IconName } from '@/components/ui/icon';
import { Alert, Avatar } from '@/components/ui/misc';
import { useToast } from '@/components/providers/feedback-provider';
import { schedulerToastText } from '@/components/providers/data-provider';
import { loginSSO } from '@/services/auth';
import { authApi } from '@/services/api/endpoints';
import { API_BASE_URL } from '@/services/api/client';
import * as repo from '@/services/repo';
import { isApiMode } from '@/lib/config';
import { role, user as userById } from '@/services/lookup';
import { autoScheduler } from '@/services/scheduler';
import { can } from '@/services/session';
import type { User } from '@/types';

const FEATURES: [IconName, string, string][] = [
  ['box', 'Inventaris terpusat', 'Kode/QR, kategori, lokasi, kondisi, status, dan foto barang.'],
  ['out', 'Transaksi dicatat petugas', 'Peminjam tidak mengisi formulir dan tidak wajib memiliki akun.'],
  ['bell', 'Pengingat otomatis', 'Email H-3, H-1, H, H+1 serta eskalasi H+3 dan H+7.'],
  ['shield', 'Aman & dapat ditelusuri', 'RBAC, JWT, SSO OIDC, audit log, dan backup.'],
];

export default function LoginPage() {
  useTitle('Masuk');
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ssoOpen, setSsoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const settings = db.data.settings;
  const oidc = useMemo(() => ({ state: uid(), nonce: uid() }), []);
  const [pub, setPub] = useState<{ institution: string; oidc_enabled: boolean } | null>(null);
  const institution = pub?.institution || settings.institution;
  const oidcEnabled = pub ? pub.oidc_enabled : settings.security.oidc_enabled;


  // Sudah login → langsung ke halaman awal.
  useEffect(() => {
    if (user) router.replace(homeFor((p) => can(p, user)));
  }, [user, router]);

  const afterLogin = (u: User, via?: string) => {
    toast(via ? `Masuk melalui SSO sebagai ${u.name}.` : `Selamat datang, ${u.name}.`);
    const res = isApiMode ? null : autoScheduler();
    if (res && (res.sent || res.late_marked)) setTimeout(() => toast(schedulerToastText(res, settings.scheduler.time), 'warn'), 500);
    router.replace(homeFor((p) => can(p, u)));
  };

  // Mode api: info publik (nama instansi, SSO aktif) + selesaikan login SSO (#sso_code dari backend).
  useEffect(() => {
    if (!isApiMode) return;
    fetch(`${API_BASE_URL}/settings/public`)
      .then((r) => r.json())
      .then((j) => j?.data && setPub(j.data))
      .catch(() => undefined);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get('sso_code');
    const ssoErr = hash.get('sso_error');
    if (!code && !ssoErr) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (ssoErr) {
      queueMicrotask(() => setError(`Login SSO gagal: ${ssoErr}`));
      return;
    }
    queueMicrotask(() => setBusy(true));
    repo.loginSso(code!).then((r) => {
      setBusy(false);
      if (!r.ok) return setError(r.error);
      afterLogin(r.user, 'SSO');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya sekali saat halaman dibuka
  }, []);

  const submit = async (username: string, password: string) => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'Wajib diisi.';
    if (!password) errs.password = 'Wajib diisi.';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await repo.login(username, password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    afterLogin(r.user);
  };

  const onSSO = () => {
    if (!oidcEnabled) return toast('SSO/OIDC belum diaktifkan oleh administrator.', 'warn');
    if (isApiMode) {
      // Alur OAuth 2.0 / OIDC ditangani backend (Authlib): state & nonce divalidasi di server.
      window.location.href = authApi.ssoUrl();
      return;
    }
    setSsoOpen(true);
  };

  return (
    <div className="login">
      <div className="login-side">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-logo" style={{ width: 44, height: 44 }}>
            <Icon name="box" size={24} />
          </span>
          <div>
            <div className="brand-name" style={{ fontSize: 20 }}>
              SIIPB
            </div>
            <div className="brand-sub" style={{ fontSize: 13 }}>
              {institution}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <h1>Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang</h1>
          <p style={{ color: '#c8d9e6', fontSize: 15, maxWidth: 480 }}>
            Ruang kerja petugas Sarpras/IT untuk mendata inventaris, mencatat transaksi, memantau keterlambatan, dan menyusun laporan.
          </p>
        </div>
        <ul>
          {FEATURES.map(([ic, title, text]) => (
            <li key={title}>
              <span className="ico">
                <Icon name={ic} size={16} />
              </span>
              <span>
                <b>{title}</b>
                {text}
              </span>
            </li>
          ))}
        </ul>
        <span style={{ marginTop: 'auto', fontSize: 12, color: '#9fb3c4' }}>{isApiMode ? 'Terhubung ke Flask REST API' : 'Mode demo · data tersimpan di browser ini'}</span>
      </div>

      <div className="login-main">
        <div className="login-card stack">
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 650 }}>Masuk</h2>
            <p className="muted">Khusus pengguna internal: administrator, petugas, dan pimpinan.</p>
          </div>
          <form
            className="stack"
            style={{ gap: 14 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit(form.username, form.password);
            }}
          >
            {error && <Alert type="danger">{error}</Alert>}
            <TextField
              label="Username atau email"
              required
              autoComplete="username"
              value={form.username}
              error={errors.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <TextField
              label="Kata sandi"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              error={errors.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button type="submit" variant="primary" icon="lock" block disabled={busy}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </Button>
          </form>
          <div className="or">atau</div>
          <Button icon="key" block onClick={onSSO}>
            Masuk dengan SSO Organisasi
          </Button>
          <Alert type="info">
            Peminjam <b>tidak perlu login</b>. Informasi peminjaman, pengingat, dan pemberitahuan keterlambatan dikirim otomatis ke email peminjam.
          </Alert>
        </div>
      </div>

      <Modal open={ssoOpen} onClose={() => setSsoOpen(false)} title="SSO Organisasi (OpenID Connect)" desc="Simulasi halaman Identity Provider organisasi.">
        <div className="stack" style={{ gap: 12 }}>
          <div className="code-block">
            {`GET ${settings.security.oidc_issuer}/protocol/openid-connect/auth\n  ?client_id=${settings.security.oidc_client_id}&response_type=code&scope=openid%20email%20profile\n  &state=${oidc.state}&nonce=${oidc.nonce}`}
          </div>
          <div className="label">Pilih akun organisasi</div>
          <div className="demo-acc">
            {db.all('oauth_accounts').map((a) => {
              const u = userById(a.user_id);
              if (!u) return null;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    const r = loginSSO(u.id);
                    setSsoOpen(false);
                    if (!r.ok) return toast(r.error, 'err');
                    afterLogin(r.user, 'sso');
                  }}
                >
                  <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                    <Avatar name={u.name} />
                    <span>
                      <b>{u.name}</b>
                      <br />
                      <span className="small muted">{a.email}</span>
                    </span>
                  </span>
                  <Tag>{role(u.role_id)?.name}</Tag>
                </button>
              );
            })}
          </div>
          <p className="small muted">
            Setelah login di IdP, SIIPB menerima <i>authorization code</i>, memvalidasi <span className="mono">state</span>, <span className="mono">nonce</span> dan ID token, lalu
            menerbitkan JWT internal.
          </p>
        </div>
      </Modal>
    </div>
  );
}
