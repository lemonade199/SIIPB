'use client';

import Link from 'next/link';
import { CAPABILITIES } from '@/lib/config';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, greeting, today } from '@/lib/date';
import { ITEM_STATUS } from '@/lib/constants';
import { num } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, StatTile } from '@/components/ui/card';
import { Alert, Empty, KV, PageHead } from '@/components/ui/misc';
import { BorrowBadge, DueText } from '@/components/domain/borrow-status';
import { useToast } from '@/components/providers/feedback-provider';
import { stats } from '@/services/dashboard';
import { emp, itemsOf, userName } from '@/services/lookup';
import { lastSchedulerRun, runScheduler } from '@/services/scheduler';
import type { ItemStatus } from '@/types';

const STAT_COLORS: Record<ItemStatus, string> = {
  TERSEDIA: '#15803d',
  DIPINJAM: '#1d4ed8',
  RUSAK: '#b7791f',
  RUSAK_BERAT: '#b91c1c',
  DALAM_PERBAIKAN: '#6b3fa0',
  HILANG: '#7f1d1d',
};

export default function DashboardPage() {
  useTitle('Dashboard');
  const { user, role, can } = useAuth();
  const toast = useToast();
  if (!user) return null;

  const st = stats();
  const canBorrow = can('borrowing.manage');
  const canReturn = can('return.manage');
  const broken = st.byStatus.RUSAK + st.byStatus.RUSAK_BERAT + st.byStatus.DALAM_PERBAIKAN + st.byStatus.HILANG;
  const need = [...st.late, ...st.due].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const maxM = Math.max(1, ...st.months.map((m) => m.count));
  const run = lastSchedulerRun();
  const sc = db.data.settings.scheduler;
  const acts = db.all('activity_logs').slice(-6).reverse();

  const onRun = () => {
    const r = runScheduler({ trigger: 'manual', user_id: user.id });
    toast(`Pemeriksaan selesai: ${r.checked} diperiksa, ${r.late_marked} menjadi TERLAMBAT, ${r.sent} terkirim, ${r.skipped} dilewati (sudah pernah dikirim).`);
  };

  return (
    <>
      <PageHead
        crumb="Beranda"
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        desc={`${fmtDate(today(), true)} · ${st.late.length} terlambat, ${st.due.length} jatuh tempo dalam 3 hari`}
        actions={
          <>
            {canBorrow && (
              <Button variant="primary" icon="out" href="/peminjaman/baru">
                Catat Peminjaman
              </Button>
            )}
            {canReturn && (
              <Button icon="in" href="/pengembalian/baru">
                Catat Pengembalian
              </Button>
            )}
            {!canBorrow && (
              <Button icon="file" href="/laporan">
                Lihat Laporan
              </Button>
            )}
          </>
        }
      />

      {role?.code === 'pimpinan' && (
        <Alert type="info" className="mb-4">
          Anda masuk sebagai <b>Pimpinan</b>: dapat melihat dashboard, monitoring, dan laporan, serta menerima eskalasi H+7. Pencatatan transaksi dilakukan oleh petugas.
        </Alert>
      )}

      <div className="grid mb-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        <StatTile label="Total barang aktif" value={num(st.total)} sub="Seluruh inventaris" icon="box" tone="primary" href="/inventaris" />
        <StatTile label="Tersedia" value={num(st.byStatus.TERSEDIA)} sub="Siap dipinjam" icon="checkCircle" tone="ok" href="/inventaris?status=TERSEDIA" />
        <StatTile
          label="Sedang dipinjam"
          value={num(st.active.length)}
          sub={`${st.byStatus.DIPINJAM} barang dalam ${st.active.length} transaksi`}
          icon="out"
          tone="info"
          href="/monitoring"
        />
        <StatTile label="Jatuh tempo ≤ 3 hari" value={num(st.due.length)} sub="H-3 sampai hari ini" icon="clock" tone="warn" href="/monitoring?tab=jatuh_tempo" />
        <StatTile label="Terlambat" value={num(st.late.length)} sub="Melewati batas kembali" icon="alert" tone="late" href="/monitoring?tab=terlambat" />
        <StatTile label="Rusak / perbaikan / hilang" value={num(broken)} sub="Tidak dapat dipinjam" icon="wrench" tone="purple" href="/laporan?type=kerusakan" />
      </div>

      <div className="split">
        <div className="stack">
          <Card
            title="Perlu tindakan"
            desc="Terlambat dan jatuh tempo ≤ 3 hari, diurutkan dari batas paling awal"
            actions={
              <Button size="sm" href="/monitoring">
                Monitoring
              </Button>
            }
          >
            {need.length ? (
              <ul className="list">
                {need.map((b) => (
                  <li key={b.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/peminjaman/${b.id}`} className="cell-title">
                        {emp(b.employee_id)?.name}
                      </Link>{' '}
                      <span className="mono small muted">{b.code}</span>
                      <div className="cell-sub">
                        {itemsOf(b)
                          .map((i) => i.item_name)
                          .join(', ')}{' '}
                        · batas {fmtDate(b.due_date)}
                      </div>
                    </div>
                    <BorrowBadge b={b} />
                    <span className="nowrap small">
                      <DueText b={b} />
                    </span>
                    {canReturn && (
                      <Button size="sm" href={`/pengembalian/baru?pinjam=${b.id}`}>
                        Kembalikan
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="checkCircle">Tidak ada transaksi yang jatuh tempo atau terlambat.</Empty>
            )}
          </Card>

          <Card title="Statistik peminjaman" desc="Jumlah transaksi peminjaman per bulan (6 bulan terakhir)">
            <div className="bars" role="img" aria-label={`Jumlah peminjaman per bulan: ${st.months.map((m) => `${m.label} ${m.count}`).join(', ')}`}>
              {st.months.map((m) => (
                <div key={m.key} className="bar" title={`${m.label}: ${m.count} transaksi`}>
                  <span className="v">{m.count}</span>
                  <i style={{ height: Math.round((m.count / maxM) * 130) }} />
                </div>
              ))}
            </div>
            <div className="bars-labels">
              {st.months.map((m) => (
                <span key={m.key}>{m.label}</span>
              ))}
            </div>
          </Card>

          <Card title="Barang paling sering dipinjam per kategori">
            <ul className="list">
              {st.perCat.map((c) => (
                <li key={c.name}>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span className="mono strong">{c.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="stack">
          <Card title="Status barang" desc="Status selalu mengikuti transaksi">
            <ul className="list">
              {ITEM_STATUS.map((s) => {
                const n = st.byStatus[s] || 0;
                return (
                  <li key={s} style={{ display: 'block' }}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <Badge status={s} />
                      <span className="strong mono">{n}</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${st.total ? ((n / st.total) * 100).toFixed(1) : 0}%`, background: STAT_COLORS[s] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title="Pemeriksaan terjadwal"
            actions={
              CAPABILITIES.scheduler && can('notification.manage') && (
                <Button size="sm" icon="play" onClick={onRun}>
                  Jalankan
                </Button>
              )
            }
          >
            {run ? (
              <KV
                items={[
                  ['Terakhir dijalankan', fmtDateTime(run.at)],
                  ['Pemicu', run.trigger],
                  ['Diperiksa', `${run.checked} transaksi`],
                  ['Hasil', `${run.late_marked} jadi terlambat · ${run.sent} terkirim · ${run.skipped} dilewati`],
                ]}
              />
            ) : (
              <p className="muted">Belum pernah dijalankan.</p>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>
              {CAPABILITIES.scheduler ? (
                <>
                  Celery Beat memeriksa setiap hari pukul <b>{sc.time}</b> ({sc.timezone}).
                </>
              ) : (
                <>Pemeriksaan keterlambatan dijalankan oleh Celery Beat di server.</>
              )}
            </p>
          </Card>

          {st.drafts.length > 0 && (
            <Card title="Draf belum diserahkan" desc="Belum checkout — status barang belum berubah">
              <ul className="list">
                {st.drafts.map((b) => (
                  <li key={b.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link className="cell-title" href={`/peminjaman/${b.id}`}>
                        {emp(b.employee_id)?.name}
                      </Link>
                      <div className="cell-sub mono">{b.code}</div>
                    </div>
                    <Badge status="DRAF" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {can('audit.view') && (
            <Card
              title="Aktivitas terbaru"
              actions={
                <Button size="sm" href="/audit">
                  Audit log
                </Button>
              }
            >
              <ul className="list">
                {acts.map((a) => (
                  <li key={a.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>
                        <b>{userName(a.user_id)}</b> · <span className="mono">{a.action}</span>
                      </div>
                      <div className="cell-sub">{fmtDateTime(a.at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
