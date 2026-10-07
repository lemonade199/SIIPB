'use client';

import Link from 'next/link';
import { CAPABILITIES, isApiMode } from '@/lib/config';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, offsetDays, today } from '@/lib/date';
import { TEMPLATE_PLACEHOLDERS } from '@/lib/constants';
import { download } from '@/lib/file';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field, SelectField, Switch, TextareaField, TextField } from '@/components/ui/form';
import { Icon, type IconName } from '@/components/ui/icon';
import { Alert, KV, PageHead } from '@/components/ui/misc';
import { useConfirm, useToast } from '@/components/providers/feedback-provider';
import { logout } from '@/services/auth';
import { backupJSON, restoreJSON } from '@/services/backup';
import { fillTemplate, templateVars } from '@/services/notification';
import { recordBackup, recordRestoreTest, shiftDemoDays } from '@/services/settings';
import * as repo from '@/services/repo';
import type { EmailTemplate, RecipientKind, Settings } from '@/types';

type Tab = 'umum' | 'smtp' | 'notifikasi' | 'template' | 'keamanan' | 'backup' | 'demo';
const TABS: [Tab, string, IconName][] = [
  ['umum', 'Umum', 'building'],
  ['smtp', 'SMTP', 'mail'],
  ['notifikasi', 'Aturan notifikasi', 'bell'],
  ['template', 'Template email', 'file'],
  ['keamanan', 'Keamanan & SSO', 'lock'],
  ['backup', 'Backup & pemulihan', 'database'],
  ['demo', 'Mode demo', 'play'],
];

export default function PengaturanPage() {
  useTitle('Pengaturan');
  const params = useSearchParams();
  const t = params.get('tab') as Tab | null;
  const tabs = TABS.filter(([k]) => CAPABILITIES.demoClock || k !== 'demo');
  const tab: Tab = t && tabs.some((x) => x[0] === t) ? t : 'umum';
  const s = db.data.settings;

  return (
    <>
      <PageHead crumb="Beranda / Administrasi" title="Pengaturan" desc="Konfigurasi SMTP, template, aturan notifikasi, keamanan, dan backup." />
      <div className="split" style={{ gridTemplateColumns: '230px minmax(0,1fr)' }}>
        <nav className="card" style={{ padding: 8 }} aria-label="Bagian pengaturan">
          {tabs.map(([k, l, ic]) => (
            <Link
              key={k}
              href={`/pengaturan?tab=${k}`}
              className="row"
              aria-current={tab === k ? 'page' : undefined}
              style={{
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                color: tab === k ? 'var(--fg)' : 'var(--muted-foreground)',
                background: tab === k ? 'var(--hover)' : 'transparent',
                fontWeight: tab === k ? 600 : 500,
                flexWrap: 'nowrap',
              }}
            >
              <Icon name={ic} size={17} />
              {l}
            </Link>
          ))}
        </nav>
        <div className="stack">
          {tab === 'umum' && <Umum key="umum" s={s} />}
          {tab === 'smtp' && <Smtp key="smtp" s={s} />}
          {tab === 'notifikasi' && <Notifikasi key="notif" s={s} />}
          {tab === 'template' && <Templates />}
          {tab === 'keamanan' && <Keamanan key="sec" s={s} />}
          {tab === 'backup' && <Backup s={s} />}
          {tab === 'demo' && <Demo s={s} />}
        </div>
      </div>
    </>
  );
}

function SaveBtn() {
  return (
    <div className="full">
      <Button variant="primary" type="submit" icon="check">
        Simpan
      </Button>
    </div>
  );
}

/* ---------- Umum ---------- */
function Umum({ s }: { s: Settings }) {
  const toast = useToast();
  const [v, setV] = useState({ institution: s.institution, unit_sarpras: s.unit_sarpras, staff_email: s.staff_email, staff_phone: s.staff_phone, return_location: s.return_location });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <Card title="Identitas & kontak">
      <form
        className="form-grid"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!v.institution.trim()) return setErr('Wajib diisi.');
          setErr('');
          const r = await repo.saveSettings(Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim()])), 'umum');
          toast(r.ok ? 'Pengaturan umum disimpan.' : r.error, r.ok ? 'ok' : 'err');
        }}
      >
        <TextField label="Nama instansi" required value={v.institution} error={err} onChange={set('institution')} />
        <TextField label="Nama unit pengelola" value={v.unit_sarpras} onChange={set('unit_sarpras')} />
        <TextField label="Email petugas Sarpras/IT" type="email" value={v.staff_email} onChange={set('staff_email')} />
        <TextField label="Telepon / ext. petugas" value={v.staff_phone} onChange={set('staff_phone')} />
        <TextField label="Tempat pengembalian barang" full hint="Dicantumkan pada email ke peminjam." value={v.return_location} onChange={set('return_location')} />
        <SaveBtn />
      </form>
    </Card>
  );
}

/* ---------- SMTP ---------- */
function Smtp({ s }: { s: Settings }) {
  const toast = useToast();
  const { user } = useAuth();
  const [v, setV] = useState({ ...s.smtp });
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const passwordSet = (s.smtp as Settings['smtp'] & { password_set?: boolean }).password_set;
  return (
    <Card title="Server email (SMTP)">
      <form
        className="form-grid"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const smtp = { ...v, host: v.host.trim(), port: Number(v.port), username: v.username.trim(), from_name: v.from_name.trim(), from_email: v.from_email.trim() };
          delete (smtp as { password_set?: boolean }).password_set;
          const r = await repo.saveSettings({ smtp, smtp_password: password || undefined }, 'SMTP');
          if (r.ok) setPassword('');
          toast(r.ok ? 'Pengaturan SMTP disimpan.' : r.error, r.ok ? 'ok' : 'err');
        }}
      >
        <TextField label="Host" mono value={v.host} onChange={(e) => setV({ ...v, host: e.target.value })} />
        <TextField label="Port" type="number" mono value={v.port} onChange={(e) => setV({ ...v, port: Number(e.target.value) })} />
        <TextField label="Username" mono value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} />
        <SelectField
          label="Enkripsi"
          value={v.encryption}
          onChange={(e) => setV({ ...v, encryption: e.target.value })}
          options={['STARTTLS', 'SSL/TLS', 'Tidak ada'].map((x) => ({ value: x, label: x }))}
        />
        <TextField label="Nama pengirim" value={v.from_name} onChange={(e) => setV({ ...v, from_name: e.target.value })} />
        <TextField label="Email pengirim" type="email" value={v.from_email} onChange={(e) => setV({ ...v, from_email: e.target.value })} />
        {isApiMode && (
          <TextField
            label="Kata sandi SMTP"
            type="password"
            autoComplete="new-password"
            value={password}
            hint={passwordSet ? 'Sudah tersimpan (terenkripsi). Kosongkan bila tidak diubah.' : 'Belum diisi — email disimulasikan (mode pengembangan).'}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <div className="full">
          <Alert type="info">
            {isApiMode
              ? 'Kata sandi SMTP disimpan terenkripsi di server dan tidak pernah dikirim kembali ke browser. JWT secret, OAuth client secret, dan kredensial database tetap diatur lewat environment variable / secret manager.'
              : 'Kata sandi SMTP, JWT secret, OAuth client secret, dan kredensial MinIO disimpan sebagai environment variable / secret manager — tidak ditampilkan di antarmuka dan tidak masuk repository.'}
          </Alert>
        </div>
        <label className="check full">
          <Checkbox checked={v.simulate_failure} onCheckedChange={(c) => setV({ ...v, simulate_failure: c === true })} />
          <span>
            Simulasikan kegagalan SMTP <span className="muted small">(untuk mencoba status GAGAL dan kirim ulang)</span>
          </span>
        </label>
        <div className="full row">
          <Button variant="primary" type="submit" icon="check">
            Simpan
          </Button>
          <Button
            icon="send"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              const r = await repo.testSmtp();
              setTesting(false);
              toast(isApiMode ? r.message : r.ok ? `Email uji terkirim ke ${user?.email} melalui ${s.smtp.host}:${s.smtp.port}.` : 'Email uji gagal: koneksi SMTP ditolak.', r.ok ? 'ok' : 'err');
            }}
          >
            {isApiMode ? 'Uji koneksi SMTP' : 'Kirim email uji'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ---------- Aturan notifikasi ---------- */
function Notifikasi({ s }: { s: Settings }) {
  const toast = useToast();
  const [v, setV] = useState({ time: s.scheduler.time, timezone: s.scheduler.timezone, enabled: s.scheduler.enabled, checkout_notify: s.checkout_notify, return_notify: s.return_notify });
  const [err, setErr] = useState('');
  return (
    <>
      <Card title="Penjadwal (Celery Beat)">
        <form
          className="form-grid"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\d{2}:\d{2}$/.test(v.time)) return setErr('Format jam HH:MM.');
            setErr('');
            const r = await repo.saveSettings(
              { scheduler: { ...s.scheduler, time: v.time, timezone: v.timezone, enabled: v.enabled }, checkout_notify: v.checkout_notify, return_notify: v.return_notify },
              'penjadwal',
            );
            toast(r.ok ? 'Pengaturan penjadwal disimpan.' : r.error, r.ok ? 'ok' : 'err');
          }}
        >
          <TextField label="Jam pemeriksaan harian" type="time" value={v.time} error={err} onChange={(e) => setV({ ...v, time: e.target.value })} />
          <SelectField
            label="Zona waktu"
            value={v.timezone}
            onChange={(e) => setV({ ...v, timezone: e.target.value })}
            options={['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].map((x) => ({ value: x, label: x }))}
          />
          <label className="check">
            <Checkbox checked={v.enabled} onCheckedChange={(c) => setV({ ...v, enabled: c === true })} /> Scheduler aktif
          </label>
          <label className="check">
            <Checkbox checked={v.checkout_notify} onCheckedChange={(c) => setV({ ...v, checkout_notify: c === true })} /> Kirim email saat checkout
          </label>
          <label className="check">
            <Checkbox checked={v.return_notify} onCheckedChange={(c) => setV({ ...v, return_notify: c === true })} /> Izinkan konfirmasi pengembalian
          </label>
          <SaveBtn />
        </form>
      </Card>
      <Card title="Aturan pengingat & eskalasi" desc="Waktu, penerima, dan template dapat dikonfigurasi" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kejadian</th>
                <th>Waktu kirim</th>
                <th>Isi</th>
                <th className="center">Peminjam</th>
                <th className="center">Petugas</th>
                <th className="center">Pimpinan</th>
                <th>Template</th>
                <th className="center">Aktif</th>
              </tr>
            </thead>
            <tbody>
              {s.rules.map((r, i) => (
                <tr key={r.event}>
                  <td className="mono strong">{r.event}</td>
                  <td className="small">{r.days < 0 ? `${-r.days} hari sebelum batas` : r.days === 0 ? 'Pada hari batas' : `${r.days} hari setelah batas`}</td>
                  <td className="small">{r.desc}</td>
                  {(['peminjam', 'petugas', 'pimpinan'] as RecipientKind[]).map((to) => (
                    <td key={to} className="center">
                      <Checkbox
                        checked={r.to.includes(to)}
                        disabled={to === 'peminjam'}
                        aria-label={`${r.event} ke ${to}`}
                        onCheckedChange={async (c) => {
                          const res = await repo.setRuleRecipient(i, to, c === true);
                          const rr = db.data.settings.rules[i];
                          toast(res.ok ? `Penerima ${rr.event}: ${rr.to.join(' + ')}.` : res.error, res.ok ? 'ok' : 'err');
                        }}
                      />
                    </td>
                  ))}
                  <td className="mono small">{r.template}</td>
                  <td className="center">
                    <Switch
                      checked={r.active}
                      aria-label={`Aktifkan ${r.event}`}
                      onCheckedChange={async (c) => {
                        const res = await repo.setRuleActive(i, c);
                        const rr = db.data.settings.rules[i];
                        toast(res.ok ? `Aturan ${rr.event} ${rr.active ? 'diaktifkan' : 'dinonaktifkan'}.` : res.error, res.ok ? 'ok' : 'err');
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ padding: '12px 20px' }}>
          Perubahan pada tabel ini langsung tersimpan. Peminjam selalu menerima notifikasi.
        </p>
      </Card>
    </>
  );
}

/* ---------- Template email ---------- */
function Templates() {
  const toast = useToast();
  const [edit, setEdit] = useState<{ t: EmailTemplate; subject: string; body: string } | null>(null);
  const [err, setErr] = useState('');
  const sample = db.find('borrowings', (x) => x.status === 'TERLAMBAT') || db.all('borrowings')[0];
  const vars = sample ? templateVars(sample, {}) : {};

  return (
    <>
      <Card title="Template email" desc="Gunakan placeholder {{…}} yang diisi otomatis oleh sistem" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Subjek</th>
                <th>Diperbarui</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {db.all('email_templates').map((t) => (
                <tr key={t.id}>
                  <td className="mono small">{t.code}</td>
                  <td className="strong">{t.name}</td>
                  <td className="small">{t.subject}</td>
                  <td className="small nowrap">{fmtDateTime(t.updated_at)}</td>
                  <td className="right">
                    <Button
                      size="sm"
                      icon="pencil"
                      onClick={() => {
                        setErr('');
                        setEdit({ t, subject: t.subject, body: t.body });
                      }}
                    >
                      Ubah
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        size="lg"
        title={`Template: ${edit?.t.name}`}
        desc={<span className="mono">{edit?.t.code}</span>}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Batal</Button>
            <Button
              variant="primary"
              icon="check"
              onClick={async () => {
                if (!edit) return;
                if (!edit.subject.trim()) return setErr('Wajib diisi.');
                const r = await repo.saveTemplate(edit.t.id, edit.subject, edit.body);
                if (!r.ok) return setErr(r.error);
                setEdit(null);
                toast('Template disimpan.');
              }}
            >
              Simpan template
            </Button>
          </>
        }
      >
        {edit && (
          <div className="stack" style={{ gap: 12 }}>
            <TextField label="Subjek" required value={edit.subject} error={err} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
            <TextareaField label="Isi email" rows={12} mono value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <div className="small muted">
              Placeholder:{' '}
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <Tag key={p} className="mono m-0.5">
                  {`{{${p}}}`}
                </Tag>
              ))}
            </div>
            {sample && (
              <>
                <div className="label">Pratinjau (contoh: {sample.code})</div>
                <div className="email">
                  <div className="email-head">
                    <span className="subj">{fillTemplate(edit.subject, vars)}</span>
                  </div>
                  <div className="email-body" style={{ maxHeight: 240, overflow: 'auto' }}>
                    {fillTemplate(edit.body, vars)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------- Keamanan ---------- */
function Keamanan({ s }: { s: Settings }) {
  const toast = useToast();
  const [v, setV] = useState({ ...s.security });
  const num = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });
  return (
    <Card title="Keamanan, JWT & SSO">
      <form
        className="form-grid"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await repo.saveSettings({ security: { ...v, oidc_issuer: v.oidc_issuer.trim(), oidc_client_id: v.oidc_client_id.trim() } }, 'keamanan');
          toast(r.ok ? 'Pengaturan keamanan disimpan.' : r.error, r.ok ? 'ok' : 'err');
        }}
      >
        <TextField label="Masa berlaku access token (menit)" type="number" min={5} value={v.jwt_access_minutes} onChange={num('jwt_access_minutes')} />
        <TextField label="Masa berlaku refresh token (hari)" type="number" min={1} value={v.jwt_refresh_days} onChange={num('jwt_refresh_days')} />
        <TextField label="Sesi antarmuka (jam)" type="number" min={1} value={v.session_hours} onChange={num('session_hours')} />
        <TextField label="Batas ukuran unggahan foto (MB)" type="number" min={1} max={10} value={v.upload_max_mb} onChange={num('upload_max_mb')} />
        <label className="check full">
          <Checkbox checked={v.oidc_enabled} onCheckedChange={(c) => setV({ ...v, oidc_enabled: c === true })} /> Aktifkan login SSO (OAuth 2.0 + OpenID Connect)
        </label>
        <TextField label="Issuer / Identity Provider" mono full value={v.oidc_issuer} onChange={(e) => setV({ ...v, oidc_issuer: e.target.value })} />
        <TextField label="Client ID" mono value={v.oidc_client_id} onChange={(e) => setV({ ...v, oidc_client_id: e.target.value })} />
        <Field label="Client secret">
          <Input value="disimpan di secret manager" readOnly aria-label="Client secret" />
        </Field>
        <div className="full">
          <Alert type="info">
            Wajib HTTPS di production. OIDC memakai validasi <span className="mono">state</span>/<span className="mono">nonce</span> dan token sesuai standar. Validasi input dilakukan di backend; unggahan dibatasi ukuran dan tipe.
          </Alert>
        </div>
        <SaveBtn />
      </form>
    </Card>
  );
}

/* ---------- Backup ---------- */
function Backup({ s }: { s: Settings }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Card title="Backup MariaDB">
        <KV
          items={[
            ['Jadwal', s.backup.schedule],
            ['Retensi', `${s.backup.retention_days} hari`],
            ['Uji restore terakhir', fmtDateTime(s.backup.last_restore_test)],
            ['Jumlah backup', String(s.backup.history.length)],
          ]}
        />
        {isApiMode ? (
          <div className="row" style={{ marginTop: 14 }}>
            <Button
              variant="primary"
              icon="database"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await repo.backupNow();
                setBusy(false);
                toast(r.message, r.ok ? 'ok' : 'err');
              }}
            >
              {busy ? 'Membuat backup…' : 'Backup database sekarang'}
            </Button>
          </div>
        ) : (
        <div className="row" style={{ marginTop: 14 }}>
          <Button
            variant="primary"
            icon="download"
            onClick={() => {
              const json = backupJSON();
              download(`siipb-backup-${today()}.json`, json, 'application/json');
              recordBackup(Math.round(json.length / 1024), user?.username || '');
              toast('Backup dibuat dan diunduh.');
            }}
          >
            Backup sekarang (unduh .json)
          </Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Pulihkan dari berkas…
          </Button>
          <Button
            icon="refresh"
            onClick={() => {
              recordRestoreTest();
              toast('Uji restore dicatat.');
            }}
          >
            Catat uji restore
          </Button>
        </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const ok = await confirm({
              title: 'Pulihkan data dari backup?',
              message: (
                <>
                  Seluruh data saat ini akan diganti dengan isi <b>{f.name}</b>.
                </>
              ),
              confirmText: 'Pulihkan',
              danger: true,
            });
            if (!ok) return;
            const r = restoreJSON(await f.text());
            if (!r.ok) return toast(r.error, 'err');
            toast('Data berhasil dipulihkan.');
          }}
        />
        <p className="small muted" style={{ marginTop: 10 }}>
          {isApiMode ? (
            <>
              Backup memakai <span className="mono">mariadb-dump</span> (gzip) dan dijadwalkan Celery Beat setiap hari 01.00. Pemulihan dilakukan administrator server dengan
              <span className="mono"> infrastructure/scripts/restore_db.sh</span> agar tidak dapat dipicu dari browser.
            </>
          ) : (
            'Pada mode demo, backup berisi seluruh data aplikasi dalam format JSON. Di production, backup MariaDB dijadwalkan dan diuji dengan restore berkala.'
          )}
        </p>
      </Card>
      <Card title="Riwayat backup" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Jenis</th>
                <th>Ukuran</th>
                <th>Oleh</th>
                <th>Status</th>
                {isApiMode && <th />}
              </tr>
            </thead>
            <tbody>
              {s.backup.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <tr key={i}>
                    <td className="small">{fmtDateTime(h.at)}</td>
                    <td>{h.type}</td>
                    <td className="mono">{h.size_kb} KB</td>
                    <td className="small">{h.by}</td>
                    <td>
                      <Badge status={h.status} />
                    </td>
                    {isApiMode && (
                      <td className="right">
                        {(h as typeof h & { file?: string }).file && h.status === 'SUKSES' && (
                          <Button
                            size="sm"
                            icon="download"
                            onClick={() => repo.downloadBackup((h as typeof h & { file: string }).file).catch((e: Error) => toast(e.message, 'err'))}
                          >
                            Unduh
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ---------- Mode demo ---------- */
function Demo({ s }: { s: Settings }) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { user } = useAuth();
  const [runAfter, setRunAfter] = useState(true);
  const off = offsetDays();

  const shift = (n: number | 'reset') => {
    if (!user) return;
    const r = shiftDemoDays(n, runAfter, user.id);
    let msg = `Tanggal sistem sekarang ${fmtDate(today(), true)}.`;
    if (r) msg += ` Pemeriksaan: ${r.late_marked} jadi TERLAMBAT, ${r.sent} email terkirim.`;
    toast(msg, 'warn');
  };

  return (
    <>
      <Card title="Simulasi waktu" desc="Hanya untuk demo; tidak ada pada sistem production">
        <p>Geser &quot;hari ini&quot; untuk mendemonstrasikan pengingat H-3/H-1/H, keterlambatan H+1, dan eskalasi H+3/H+7 tanpa menunggu hari berganti.</p>
        <div className="row" style={{ margin: '14px 0' }}>
          <span className={cn('date-chip', off && 'demo')} style={{ fontSize: 14 }}>
            <Icon name="calendar" size={16} /> {fmtDate(today(), true)} {off ? `(geser ${off > 0 ? '+' : ''}${off} hari)` : '(tanggal sebenarnya)'}
          </span>
        </div>
        <div className="row">
          {[-1, 1, 3, 7].map((n) => (
            <Button key={n} onClick={() => shift(n)}>
              {n > 0 ? '+' : ''}
              {n} hari
            </Button>
          ))}
          <Button variant="ghost" onClick={() => shift('reset')}>
            Kembali ke hari ini
          </Button>
        </div>
        <label className="check" style={{ marginTop: 14 }}>
          <Checkbox checked={runAfter} onCheckedChange={(c) => setRunAfter(c === true)} /> Jalankan pemeriksaan scheduler setelah menggeser tanggal
        </label>
        {s.demo_offset_days !== 0 && <p className="small muted" style={{ marginTop: 8 }}>Tanggal demo aktif: semua tampilan memakai tanggal yang digeser.</p>}
      </Card>
      <Card title="Reset data contoh">
        <p className="muted">Menghapus semua perubahan di browser ini dan membuat ulang data contoh.</p>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="danger"
            icon="trash"
            onClick={async () => {
              const ok = await confirm({
                title: 'Reset semua data?',
                message: 'Semua transaksi, barang, dan pengaturan di browser ini kembali ke data contoh. Anda akan keluar.',
                confirmText: 'Reset',
                danger: true,
              });
              if (!ok) return;
              logout();
              db.reset();
              router.replace('/login');
            }}
          >
            Reset semua data
          </Button>
        </div>
      </Card>
    </>
  );
}
