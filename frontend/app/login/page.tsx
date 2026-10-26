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
import { API_BASE_URL, fetchWithFallback } from '@/services/api/client';
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
  const [captcha, setCaptcha] = useState<{ id: string; image: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ssoOpen, setSsoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const settings = db.data.settings;
  const oidc = useMemo(() => ({ state: uid(), nonce: uid() }), []);
  const [pub, setPub] = useState<{ institution: string; oidc_enabled: boolean } | null>(null);
  const oidcEnabled = pub ? pub.oidc_enabled : settings.security.oidc_enabled;

  const loadCaptcha = async () => {
    try {
      setCaptchaLoading(true);
      if (isApiMode) {
        const data = await authApi.getCaptcha();
        setCaptcha({ id: data.captcha_id, image: data.image });
      } else {
        const mockChars = '2346789ABCDEFGHJKLMNPQRTUVWXY';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += mockChars.charAt(Math.floor(Math.random() * mockChars.length));
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" viewBox="0 0 180 48"><rect width="180" height="48" fill="#eef2f6"/><text x="90" y="32" font-size="22" font-weight="bold" font-family="monospace" fill="#1e293b" text-anchor="middle" letter-spacing="4">${code}</text></svg>`;
        setCaptcha({
          id: 'mock-' + Date.now(),
          image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        });
      }
    } catch (err) {
      console.error('Gagal memuat CAPTCHA:', err);
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

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
    fetchWithFallback(`${API_BASE_URL}/settings/public`)
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
    if (!captchaAnswer.trim()) errs.captcha_answer = 'Kode CAPTCHA wajib diisi.';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await repo.login(username, password, captcha?.id, captchaAnswer.trim());
    setBusy(false);
    if (!r.ok) {
      // kode CAPTCHA sekali pakai: setiap login gagal minta gambar baru
      setCaptchaAnswer('');
      loadCaptcha();
      if (r.errors?.captcha_answer) {
        setErrors((prev) => ({ ...prev, captcha_answer: r.errors!.captcha_answer }));
      }

      // Kosongkan input password jika login gagal karena kredensial tidak valid (password atau username salah).
      // Nilai username/email tetap dipertahankan.
      // Password TIDAK dikosongkan jika kegagalan disebabkan oleh CAPTCHA salah/kedaluwarsa,
      // gangguan jaringan, atau error internal server (5xx).
      const isCaptchaError = Boolean(r.errors?.captcha_answer || r.code === 'INVALID_CAPTCHA');
      const isNetworkOrServerError = r.code === 'NETWORK_ERROR' || r.status === 0 || (typeof r.status === 'number' && r.status >= 500);
      const isCredentialError = r.code === 'AUTH_FAILED' || r.status === 401 || (!isCaptchaError && !isNetworkOrServerError);

      if (isCredentialError && !isCaptchaError && !isNetworkOrServerError) {
        setForm((prev) => ({ ...prev, password: '' }));
        // Kembalikan fokus ke input password agar pengguna bisa langsung mengetik ulang
        document.getElementById('login-password')?.focus();
      }

      return setError(r.error);
    }
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
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({ ...prev, username: val }));
                if (errors.username) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.username;
                    return copy;
                  });
                }
              }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({ ...prev, password: val }));
                    if (errors.password) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.password;
                        return copy;
                      });
                    }
                  }}
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

            <Field label="Kode CAPTCHA" required error={errors.captcha_answer} htmlFor="login-captcha">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      height: 48,
                      width: 180,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid #0e1620',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {captchaLoading && !captcha ? (
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Memuat…</span>
                    ) : captcha?.image ? (
                      <img
                        src={captcha.image}
                        alt="Kode CAPTCHA"
                        style={{ height: '100%', width: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Gagal memuat</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={captchaLoading}
                    aria-label="Muat ulang CAPTCHA"
                    title="Muat ulang CAPTCHA"
                    style={{
                      height: 48,
                      width: 48,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid #0e1620',
                      borderRadius: 10,
                      background: '#fff',
                      cursor: captchaLoading ? 'not-allowed' : 'pointer',
                      color: 'var(--navy)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="refresh" size={18} className={captchaLoading ? 'animate-spin' : undefined} />
                  </button>
                </div>
                <Input
                  id="login-captcha"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="6 karakter"
                  maxLength={6}
                  value={captchaAnswer}
                  aria-invalid={!!errors.captcha_answer || undefined}
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}
                  onChange={(e) => {
                    setCaptchaAnswer(e.target.value.toUpperCase());
                    if (errors.captcha_answer) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.captcha_answer;
                        return copy;
                      });
                    }
                  }}
                />
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