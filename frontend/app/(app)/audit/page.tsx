'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/mock/db';
import { fmtDateTime, localDate, today } from '@/lib/date';
import { exportXlsx } from '@/lib/export';
import { match, paginate } from '@/lib/utils';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Empty, PageHead, Pager, SearchInput } from '@/components/ui/misc';
import { userName } from '@/services/lookup';
import type { ActivityLog, AuditValue } from '@/types';

const GROUPS: Record<string, string> = {
  auth: 'Login / logout',
  item: 'Barang',
  borrowing: 'Peminjaman',
  return: 'Pengembalian',
  notification: 'Notifikasi',
  scheduler: 'Scheduler',
  user: 'Pengguna',
  role: 'Role',
  settings: 'Pengaturan',
  backup: 'Backup',
  report: 'Laporan',
  qr: 'QR',
  employees: 'Master peminjam',
  categories: 'Master kategori',
  locations: 'Master lokasi',
  units: 'Master unit',
};

const ENTITY_LINK: Record<string, string> = { items: '/inventaris/', borrowings: '/peminjaman/', returns: '/pengembalian/' };

function Val({ v }: { v: AuditValue }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  if (typeof v !== 'object') return <>{String(v)}</>;
  return (
    <>
      {Object.entries(v).map(([k, x]) => (
        <div key={k}>
          <span className="muted">{k}:</span> {typeof x === 'object' ? JSON.stringify(x) : String(x)}
        </div>
      ))}
    </>
  );
}

function EntityLink({ a }: { a: ActivityLog }) {
  const base = ENTITY_LINK[a.entity];
  const label = `${a.entity}${a.entity_id ? '#' + a.entity_id : ''}`;
  return base && a.entity_id ? (
    <Link className="mono" href={`${base}${a.entity_id}`}>
      {label}
    </Link>
  ) : (
    <span className="mono">{label}</span>
  );
}

interface Filter {
  q: string;
  user: string;
  group: string;
  from: string;
  to: string;
  page: number;
}

export default function AuditPage() {
  useTitle('Audit Log');
  const [f, setF] = usePersistentState<Filter>('au.filter', { q: '', user: '', group: '', from: '', to: '', page: 1 });
  const set = patchFilter(setF);

  const rows = db
    .all('activity_logs')
    .filter(
      (a) =>
        (!f.user || String(a.user_id) === f.user) &&
        (!f.group || a.action.split('.')[0] === f.group) &&
        (!f.from || localDate(a.at) >= f.from) &&
        (!f.to || localDate(a.at) <= f.to) &&
        match(f.q, a.action, a.entity, userName(a.user_id), JSON.stringify(a.old_value), JSON.stringify(a.new_value)),
    )
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  const p = paginate(rows, f.page, 15);
  const used = [...new Set(db.all('activity_logs').map((a) => a.action.split('.')[0]))];

  const onExport = () =>
    void exportXlsx(
      `audit-log-${today()}.xlsx`,
      { title: 'AUDIT LOG SIIPB', subtitle: [db.data.settings.institution, `${rows.length} catatan · diekspor ${fmtDateTime(new Date().toISOString())}`], sheetName: 'Audit log' },
      [
        { key: 'waktu', label: 'Waktu' },
        { key: 'pengguna', label: 'Pengguna' },
        { key: 'tindakan', label: 'Tindakan' },
        { key: 'entitas', label: 'Entitas' },
        { key: 'lama', label: 'Data lama' },
        { key: 'baru', label: 'Data baru' },
        { key: 'ip', label: 'IP' },
      ],
      rows.map((a) => ({
        waktu: fmtDateTime(a.at),
        pengguna: userName(a.user_id),
        tindakan: a.action,
        entitas: `${a.entity}#${a.entity_id || ''}`,
        lama: JSON.stringify(a.old_value),
        baru: JSON.stringify(a.new_value),
        ip: a.ip,
      })),
    );

  return (
    <>
      <PageHead
        crumb="Beranda / Administrasi"
        title="Audit Log"
        desc="Setiap perubahan penting tercatat: siapa, kapan, tindakan, data lama dan data baru. Catatan tidak dapat diubah atau dihapus."
        actions={
          <Button icon="download" onClick={onExport}>
            Ekspor Excel
          </Button>
        }
      />
      <section className="card">
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari tindakan, entitas, nilai…" label="Cari" />
          <Select
            aria-label="Pengguna"
            value={f.user}
            onChange={(e) => set('user', e.target.value)}
            options={[{ value: '', label: 'Semua pengguna' }, { value: '0', label: 'Sistem (scheduler)' }, ...db.all('users').map((u) => ({ value: String(u.id), label: u.name }))]}
          />
          <Select
            aria-label="Jenis tindakan"
            value={f.group}
            onChange={(e) => set('group', e.target.value)}
            options={[{ value: '', label: 'Semua tindakan' }, ...used.map((g) => ({ value: g, label: GROUPS[g] || g }))]}
          />
          <Input type="date" aria-label="Dari tanggal" value={f.from} onChange={(e) => set('from', e.target.value)} />
          <Input type="date" aria-label="Sampai tanggal" value={f.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Tindakan</th>
                <th>Entitas</th>
                <th>Data lama</th>
                <th>Data baru</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.length ? (
                p.rows.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap small">{fmtDateTime(a.at)}</td>
                    <td className="small">{userName(a.user_id)}</td>
                    <td className="mono small strong">{a.action}</td>
                    <td className="small">
                      <EntityLink a={a} />
                    </td>
                    <td className="small diff-old" style={{ maxWidth: 240 }}>
                      <Val v={a.old_value} />
                    </td>
                    <td className="small diff-new" style={{ maxWidth: 240 }}>
                      <Val v={a.new_value} />
                    </td>
                    <td className="mono small muted">{a.ip}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <Empty icon="shield">Tidak ada catatan.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={p} label="catatan" onPage={(n) => set('page', n)} />
      </section>
    </>
  );
}
