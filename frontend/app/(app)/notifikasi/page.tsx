'use client';

import Link from 'next/link';
import { CAPABILITIES } from '@/lib/config';
import { useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { EVENT_LABEL } from '@/lib/constants';
import { capitalize, match, paginate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Alert, Empty, PageHead, Pager, SearchInput, Tabs } from '@/components/ui/misc';
import { EmailPreview } from '@/components/domain/email-preview';
import { useToast } from '@/components/providers/feedback-provider';
import { emp } from '@/services/lookup';
import * as repo from '@/services/repo';
import type { ID } from '@/types';
import { TableWrap } from '@/components/ui/table-wrap';

type Tab = 'riwayat' | 'log' | 'jadwal';
interface Filter {
  tab: Tab;
  q: string;
  event: string;
  status: string;
  page: number;
}

export default function NotifikasiPage() {
  useTitle('Notifikasi');
  const { user, can } = useAuth();
  const toast = useToast();
  const [f, setF] = usePersistentState<Filter>('nt.filter', { tab: 'riwayat', q: '', event: '', status: '', page: 1 });
  const set = patchFilter(setF);
  const [emailId, setEmailId] = useState<ID | null>(null);
  if (!user) return null;

  const s = db.data.settings;
  const failed = db.where('notifications', (n) => n.status === 'GAGAL').length;

  const onRun = async () => {
    const res = await repo.runScheduler();
    if (!res.ok) return toast(res.error, 'err');
    const r = res.result;
    setF((p) => ({ ...p, tab: 'jadwal', page: 1 }));
    toast(`Pemeriksaan selesai: ${r.checked} diperiksa, ${r.late_marked} menjadi TERLAMBAT, ${r.sent} terkirim, ${r.skipped} dilewati.`);
  };

  return (
    <>
      <PageHead
        crumb="Beranda / Notifikasi"
        title="Notifikasi Otomatis"
        desc="Email ke peminjam saat checkout, pengingat H-3/H-1/H, pemberitahuan H+1, serta eskalasi H+3 dan H+7."
        actions={
          <>
            {can('settings.manage') && (
              <Button icon="settings" href="/pengaturan?tab=notifikasi">
                Atur jadwal &amp; template
              </Button>
            )}
            {CAPABILITIES.scheduler && can('notification.manage') && (
              <Button icon="play" variant="primary" onClick={onRun}>
                Jalankan pemeriksaan sekarang
              </Button>
            )}
          </>
        }
      />
      <div className="stack">
        {failed > 0 && (
          <Alert type="danger">
            {failed} notifikasi <b>gagal</b> dikirim. Buka notifikasi untuk mengirim ulang, atau periksa konfigurasi SMTP.
          </Alert>
        )}
        <div className="grid g-auto">
          {s.rules.map((r) => (
            <div key={r.event} className="card stat" style={{ opacity: r.active ? 1 : 0.55 }}>
              <div className="stat-top">
                <span className="mono strong" style={{ color: r.days > 0 ? 'var(--late)' : r.days === 0 ? 'var(--warn)' : 'var(--primary)', fontSize: 16 }}>
                  {r.event}
                </span>
                <Badge status={r.active ? 'AKTIF' : 'NONAKTIF'} />
              </div>
              <div className="strong">{r.desc}</div>
              <div className="stat-sub">Ke: {r.to.map(capitalize).join(' + ')}</div>
            </div>
          ))}
        </div>
        <p className="small muted">
          <Icon name="clock" size={14} className="inline align-[-2px]" /> Celery Beat memeriksa transaksi aktif setiap hari pukul <b>{s.scheduler.time}</b> ({s.scheduler.timezone}). Satu
          jenis notifikasi hanya dikirim sekali per transaksi — kunci unik (transaksi, kejadian).
        </p>
        <section className="card">
          <Tabs
            label="Jenis data notifikasi"
            value={f.tab}
            onChange={(k) => set('tab', k)}
            tabs={[
              { key: 'riwayat', label: 'Riwayat notifikasi', count: db.all('notifications').length },
              { key: 'log', label: 'Log pengiriman', count: db.all('notification_logs').length },
              { key: 'jadwal', label: 'Jalannya scheduler', count: db.all('scheduler_runs').length },
            ]}
          />
          {f.tab !== 'jadwal' && (
            <div className="toolbar">
              <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari kode transaksi, nama, email…" label="Cari" />
              <Select
                aria-label="Kejadian"
                value={f.event}
                onChange={(e) => set('event', e.target.value)}
                options={[{ value: '', label: 'Semua kejadian' }, ...Object.entries(EVENT_LABEL).map(([k, l]) => ({ value: k, label: `${k} — ${l}` }))]}
              />
              <Select
                aria-label="Status"
                value={f.status}
                onChange={(e) => set('status', e.target.value)}
                options={[{ value: '', label: 'Semua status' }, ...['TERKIRIM', 'GAGAL', 'MENUNGGU'].map((k) => ({ value: k, label: k }))]}
              />
            </div>
          )}
          {f.tab === 'riwayat' && <Riwayat f={f} onPage={(n) => set('page', n)} onOpen={setEmailId} />}
          {f.tab === 'log' && <Log f={f} onPage={(n) => set('page', n)} onOpen={setEmailId} />}
          {f.tab === 'jadwal' && <Runs />}
        </section>
      </div>
      <EmailPreview id={emailId} onClose={() => setEmailId(null)} />
    </>
  );
}

function Riwayat({ f, onPage, onOpen }: { f: Filter; onPage: (n: number) => void; onOpen: (id: ID) => void }) {
  const rows = db
    .all('notifications')
    .filter((n) => {
      const b = db.get('borrowings', n.borrowing_id);
      const e = emp(b?.employee_id);
      return (!f.event || n.event === f.event) && (!f.status || n.status === f.status) && match(f.q, b?.code, e?.name, n.subject, ...n.recipients.map((r) => r.email));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const p = paginate(rows, f.page, 12);
  return (
    <>
      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Kejadian</th>
              <th>Transaksi</th>
              <th>Penerima</th>
              <th>Subjek</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.rows.length ? (
              p.rows.map((n) => {
                const b = db.get('borrowings', n.borrowing_id);
                return (
                  <tr key={n.id}>
                    <td className="nowrap small">
                      {fmtDateTime(n.created_at)}
                      <div className="cell-sub">{n.trigger === 'scheduler' ? 'Celery Beat' : 'Transaksi'}</div>
                    </td>
                    <td>
                      <span className="mono strong">{n.event}</span>
                      <div className="cell-sub">{EVENT_LABEL[n.event]}</div>
                    </td>
                    <td>
                      {b && (
                        <Link className="mono" href={`/peminjaman/${b.id}`}>
                          {b.code}
                        </Link>
                      )}
                    </td>
                    <td className="small">
                      {n.recipients.map((r) => (
                        <div key={r.email} className="nowrap">
                          {r.name} <Tag>{r.type}</Tag>
                        </div>
                      ))}
                    </td>
                    <td className="small" style={{ minWidth: 190, maxWidth: 340 }}>
                      <div className="clamp-2">{n.subject}</div>
                    </td>
                    <td>
                      <Badge status={n.status} />
                      {n.attempts > 1 && <div className="cell-sub">{n.attempts}× percobaan</div>}
                    </td>
                    <td className="right nowrap">
                      <Button size="sm" icon="eye" title="Lihat" onClick={() => onOpen(n.id)}>
                        Lihat
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty icon="mail">Belum ada notifikasi.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <Pager page={p} label="notifikasi" onPage={onPage} />
    </>
  );
}

function Log({ f, onPage, onOpen }: { f: Filter; onPage: (n: number) => void; onOpen: (id: ID) => void }) {
  const rows = db
    .all('notification_logs')
    .filter((l) => {
      const b = db.get('borrowings', l.borrowing_id);
      return (!f.event || l.event === f.event) && (!f.status || l.status === f.status) && match(f.q, b?.code, l.recipient, l.message);
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  const p = paginate(rows, f.page, 15);
  return (
    <>
      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Notifikasi</th>
              <th>Transaksi</th>
              <th>Kejadian</th>
              <th>Penerima</th>
              <th>Percobaan</th>
              <th>Status</th>
              <th>Respons</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.length ? (
              p.rows.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap small">{fmtDateTime(l.at)}</td>
                  <td>
                    <button type="button" className="link-btn mono" onClick={() => onOpen(l.notification_id)}>
                      #{l.notification_id}
                    </button>
                  </td>
                  <td className="mono">{db.get('borrowings', l.borrowing_id)?.code}</td>
                  <td className="mono strong">{l.event}</td>
                  <td className="small">
                    {l.recipient} <Tag>{l.recipient_type}</Tag>
                  </td>
                  <td className="mono">{l.attempt}</td>
                  <td>
                    <Badge status={l.status} />
                  </td>
                  <td className="small muted">{l.message}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <Empty icon="mail">Log kosong.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <Pager page={p} label="log" onPage={onPage} />
    </>
  );
}

function Runs() {
  const rows = db.all('scheduler_runs').slice().reverse();
  if (!rows.length) return <Empty icon="clock">Scheduler belum pernah berjalan.</Empty>;
  return (
    <TableWrap>
      <table className="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Tanggal diperiksa</th>
            <th>Pemicu</th>
            <th>Diperiksa</th>
            <th>Jadi terlambat</th>
            <th>Terkirim</th>
            <th>Dilewati</th>
            <th>Gagal</th>
            <th>Rincian</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap small">{fmtDateTime(r.at)}</td>
              <td className="nowrap">{fmtDate(r.today)}</td>
              <td className="small">{r.trigger}</td>
              <td className="mono">{r.checked}</td>
              <td className="mono">{r.late_marked}</td>
              <td className="mono">{r.sent}</td>
              <td className="mono">{r.skipped}</td>
              <td className="mono">{r.failed}</td>
              <td className="small">
                {r.details.length ? (
                  r.details.map((d, i) => (
                    <div key={i}>
                      <span className="mono">{d.code}</span> — {d.action}
                    </div>
                  ))
                ) : (
                  <span className="muted">Tidak ada tindakan</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
