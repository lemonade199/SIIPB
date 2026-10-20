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
import { Field, TextField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
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

export default function LoginPage() {
  useTitle('Masuk');
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ssoOpen, setSsoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const settings = db.data.settings;
  const oidc = useMemo(() => ({ state: uid(), nonce: uid() }), []);
  const [pub, setPub] = useState<{ institution: string; oidc_enabled: boolean } | null>(null);
  const oidcEnabled = pub ? pub.oidc_enabled : settings.security.oidc_enabled;

  useEffect(() => {
    if (user) router.replace(homeFor((p) => can(p, user)));
  }, [user, router]);

  const afterLogin = (u: User, via?: string) => {
    toast(via ? `Masuk via SSO sebagai ${u.name}.` : `Selamat datang, ${u.name}.`);
    const res = isApiMode ? null : autoScheduler();
    if (res && (res.sent || res.late_marked)) setTimeout(() => toast(schedulerToastText(res, settings.scheduler.time), 'warn'), 500);
    router.replace(homeFor((p) => can(p, u)));
  };

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
      queueMicrotask(() => setError(`Gagal masuk: ${ssoErr}`));
      return;
    }
    queueMicrotask(() => setBusy(true));
    repo.loginSso(code!).then((r) => {
      setBusy(false);
      if (!r.ok) return setError(r.error);
      afterLogin(r.user, 'SSO');
    });
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
    if (!oidcEnabled) return toast('SSO belum diaktifkan.', 'warn');
    if (isApiMode) {
      window.location.href = authApi.ssoUrl();
      return;
    }
    setSsoOpen(true);
  };

  return (
    <div className="signin">
      <div className="signin-panel">
        <div className="signin-brand">
          <span className="mark">
            <Icon name="box" size={26} />
          </span>
          <b>SIIPB</b>
        </div>

        <div className="signin-card">
          <div>
            <h1>Sign in</h1>
            <p>Silakan masukkan kredensial akun Anda.</p>
          </div>

          <form
            className="signin-form"
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
            <Field label="Password" required error={errors.password} htmlFor="login-password">
              <div style={{ position: 'relative' }}>
                <Input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  aria-invalid={!!errors.password || undefined}
                  style={{ paddingRight: 46 }}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPw}
                  title={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={20} />
                </button>
              </div>
            </Field>
            <Button type="submit" variant="primary" icon="lock" block disabled={busy}>
              {busy ? 'Memeriksa…' : 'Sign in'}
            </Button>
          </form>

          <div className="or">atau</div>
          <Button icon="key" block onClick={onSSO}>
            Sign in with SSO
          </Button>
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
        </div>
      </Modal>
    </div>
  );
}