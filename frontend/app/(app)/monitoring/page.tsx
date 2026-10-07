'use client';

import Link from 'next/link';
import { CAPABILITIES } from '@/lib/config';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, localDate, relDue, today } from '@/lib/date';
import { exportXlsx } from '@/lib/export';
import { match, paginate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/card';
import { Select, toOptions } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Empty, PageHead, Pager, SearchInput, Tabs } from '@/components/ui/misc';
import { BorrowBadge, DueText } from '@/components/domain/borrow-status';
import { useToast } from '@/components/providers/feedback-provider';
import { stats } from '@/services/dashboard';
import { activeBorrowings, borrowView, cat, conditionLabel, emp, itemsOf, loc, unit } from '@/services/lookup';
import { lastSchedulerRun } from '@/services/scheduler';
import * as repo from '@/services/repo';
import type { Borrowing, ItemStatus } from '@/types';

type Tab = 'aktif' | 'jatuh_tempo' | 'terlambat' | 'rusak_hilang';
const BROKEN: ItemStatus[] = ['RUSAK', 'RUSAK_BERAT', 'DALAM_PERBAIKAN', 'HILANG'];
interface Filter {
  tab: Tab;
  q: string;
  unit: string;
  category: string;
  sort: 'due' | 'borrow' | 'name';
  page: number;
}

export default function MonitoringPage() {
  useTitle('Monitoring');
  const { user, can } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [f, setF] = usePersistentState<Filter>('mo.filter', { tab: 'aktif', q: '', unit: '', category: '', sort: 'due', page: 1 });
  const set = patchFilter(setF);

  useEffect(() => {
    const tab = params.get('tab') as Tab | null;
    if (tab) setF((p) => ({ ...p, tab, page: 1 }));
  }, [params, setF]);

  if (!user) return null;
  const td = today();
  const all = activeBorrowings();
  const isDue = (b: Borrowing) => {
    const n = relDue(b.due_date, td).n;
    return n >= 0 && n <= 3;
  };
  const isLate = (b: Borrowing) => relDue(b.due_date, td).n < 0;
  const cnt = { aktif: all.length, jatuh_tempo: all.filter(isDue).length, terlambat: all.filter(isLate).length };

  const rows = all
    .filter((b) => {
      if (f.tab === 'jatuh_tempo' && !isDue(b)) return false;
      if (f.tab === 'terlambat' && !isLate(b)) return false;
      const e = emp(b.employee_id);
      const items = itemsOf(b);
      return (
        (!f.unit || e?.unit_id === Number(f.unit)) &&
        (!f.category || items.some((i) => i.category_id === Number(f.category))) &&
        match(f.q, b.code, e?.name, e?.nip, ...items.map((i) => i.item_code + ' ' + i.item_name))
      );
    })
    .sort((a, b) =>
      f.sort === 'due'
        ? a.due_date.localeCompare(b.due_date)
        : f.sort === 'borrow'
          ? b.borrow_date.localeCompare(a.borrow_date)
          : (emp(a.employee_id)?.name || '').localeCompare(emp(b.employee_id)?.name || ''),
    );
  const p = paginate(rows, f.page, 12);
  const s = stats();
  const run = lastSchedulerRun();

  const onExport = () =>
    void exportXlsx(
      `monitoring-${f.tab}-${td}.xlsx`,
      { title: 'MONITORING PEMINJAMAN', subtitle: [db.data.settings.institution, `Kategori: ${f.tab.replace('_', ' ')} · per ${fmtDate(td, true)}`], sheetName: 'Monitoring' },
      [
        { key: 'kode', label: 'Kode' },
        { key: 'peminjam', label: 'Peminjam' },
        { key: 'unit', label: 'Unit' },
        { key: 'barang', label: 'Barang' },
        { key: 'pinjam', label: 'Tgl Pinjam' },
        { key: 'batas', label: 'Batas' },
        { key: 'sisa', label: 'Sisa' },
        { key: 'status', label: 'Status' },
      ],
      rows.map((b) => {
        const e = emp(b.employee_id);
        return {
          kode: b.code,
          peminjam: e?.name,
          unit: unit(e?.unit_id)?.name,
          barang: itemsOf(b)
            .map((i) => i.item_code)
            .join(', '),
          pinjam: b.borrow_date,
          batas: b.due_date,
          sisa: relDue(b.due_date).label,
          status: borrowView(b).display,
        };
      }),
    );

  const onRun = async () => {
    const res = await repo.runScheduler();
    if (!res.ok) return toast(res.error, 'err');
    const r = res.result;
    toast(`Pemeriksaan selesai: ${r.checked} diperiksa, ${r.late_marked} menjadi TERLAMBAT, ${r.sent} email terkirim, ${r.skipped} dilewati (duplikat).`);
  };

  return (
    <>
      <PageHead
        crumb="Beranda / Monitoring"
        title="Monitoring Peminjaman"
        desc="Pantau barang yang sedang dipinjam, akan jatuh tempo, dan terlambat."
        actions={
          <>
            <Button icon="download" onClick={onExport} disabled={f.tab === 'rusak_hilang'}>
              Ekspor Excel
            </Button>
            {CAPABILITIES.scheduler && can('notification.manage') && (
              <Button icon="play" variant="primary" onClick={onRun}>
                Jalankan pemeriksaan
              </Button>
            )}
          </>
        }
      />
      <div className="grid g-4 mb-[18px]">
        <StatTile label="Transaksi aktif" value={s.active.length} sub={`${s.byStatus.DIPINJAM} barang di luar`} icon="out" tone="info" />
        <StatTile label="Jatuh tempo ≤ 3 hari" value={s.due.length} sub="Pengingat H-3/H-1/H" icon="clock" tone="warn" />
        <StatTile label="Terlambat" value={s.late.length} sub="Eskalasi H+3 ke petugas, H+7 ke pimpinan" icon="alert" tone="late" />
        <StatTile
          label="Pemeriksaan terakhir"
          value={run ? fmtDateTime(run.at) : '—'}
          valueStyle={{ fontSize: 20 }}
          sub={run ? run.trigger : 'Belum dijalankan'}
          icon="refresh"
          tone="gray"
        />
      </div>
      <section className="card">
        <Tabs
          label="Kategori monitoring"
          value={f.tab}
          onChange={(k) => set('tab', k)}
          tabs={[
            { key: 'aktif', label: 'Semua aktif', count: cnt.aktif },
            { key: 'jatuh_tempo', label: 'Jatuh tempo ≤ 3 hari', count: cnt.jatuh_tempo },
            { key: 'terlambat', label: 'Terlambat', count: cnt.terlambat },
            { key: 'rusak_hilang', label: 'Rusak / hilang', count: db.where('items', (i) => i.active && BROKEN.includes(i.item_status)).length },
          ]}
        />
        {f.tab === 'rusak_hilang' ? (
          <BrokenItems q={f.q} category={f.category} onQ={(v) => set('q', v)} onCategory={(v) => set('category', v)} />
        ) : (
          <>
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari kode, peminjam, NIP, barang…" label="Cari" />
          <Select aria-label="Unit kerja" value={f.unit} onChange={(e) => set('unit', e.target.value)} options={toOptions(db.all('units'), 'Semua unit kerja')} />
          <Select aria-label="Kategori barang" value={f.category} onChange={(e) => set('category', e.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
          <Select
            aria-label="Urutkan"
            value={f.sort}
            onChange={(e) => set('sort', e.target.value as Filter['sort'])}
            options={[
              { value: 'due', label: 'Urut: batas kembali' },
              { value: 'borrow', label: 'Urut: terbaru dipinjam' },
              { value: 'name', label: 'Urut: nama peminjam' },
            ]}
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Transaksi</th>
                <th>Peminjam</th>
                <th>Barang</th>
                <th>Pinjam</th>
                <th>Batas</th>
                <th>Sisa / terlambat</th>
                <th>Status</th>
                <th>Notifikasi terakhir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.rows.length ? (
                p.rows.map((b) => {
                  const e = emp(b.employee_id);
                  const n = db.where('notifications', (x) => x.borrowing_id === b.id).sort((a, c) => c.created_at.localeCompare(a.created_at))[0];
                  return (
                    <tr key={b.id}>
                      <td>
                        <Link className="mono strong" href={`/peminjaman/${b.id}`}>
                          {b.code}
                        </Link>
                      </td>
                      <td>
                        <div className="cell-title">{e?.name}</div>
                        <div className="cell-sub">
                          {unit(e?.unit_id)?.name} · {e?.phone}
                        </div>
                      </td>
                      <td className="small">
                        {itemsOf(b).map((i) => (
                          <div key={i.id}>
                            {i.item_name} <span className="mono muted">{i.item_code}</span>
                          </div>
                        ))}
                      </td>
                      <td className="nowrap">{fmtDate(b.borrow_date)}</td>
                      <td className="nowrap">{fmtDate(b.due_date)}</td>
                      <td className="nowrap small">
                        <DueText b={b} />
                      </td>
                      <td>
                        <BorrowBadge b={b} />
                      </td>
                      <td>
                        {n ? (
                          <>
                            <div className="small">
                              <span className="mono strong">{n.event}</span> <Badge status={n.status} />
                            </div>
                            <div className="cell-sub">{fmtDateTime(n.created_at)}</div>
                          </>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td className="right nowrap">
                        {can('return.manage') ? (
                          <Button size="sm" icon="in" href={`/pengembalian/baru?pinjam=${b.id}`}>
                            Kembalikan
                          </Button>
                        ) : (
                          <Button size="sm" href={`/peminjaman/${b.id}`}>
                            Detail
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9}>
                    <Empty icon="checkCircle">{f.tab === 'terlambat' ? 'Tidak ada transaksi terlambat.' : 'Tidak ada transaksi pada kategori ini.'}</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={p} label="transaksi" onPage={(n) => set('page', n)} />
          </>
        )}
      </section>
      <p className="small muted" style={{ marginTop: 12 }}>
        <Icon name="info" size={14} className="inline align-[-2px]" /> Status TERLAMBAT ditetapkan oleh scheduler setiap hari pukul {db.data.settings.scheduler.time} WIB. Transaksi yang sudah dikembalikan tidak pernah menjadi
        terlambat.
      </p>
    </>
  );
}

/** Barang rusak, dalam perbaikan, dan hilang (cakupan monitoring dokumen bagian 3). */
function BrokenItems({ q, category, onQ, onCategory }: { q: string; category: string; onQ: (v: string) => void; onCategory: (v: string) => void }) {
  const { can } = useAuth();
  const rows = db
    .where('items', (i) => i.active && BROKEN.includes(i.item_status) && (!category || i.category_id === Number(category)) && match(q, i.item_code, i.item_name, i.brand))
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
  const since = (id: number, status: ItemStatus) =>
    db.where('item_movements', (m) => m.item_id === id && m.to_status === status).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={onQ} placeholder="Cari kode, nama, merek…" label="Cari barang" />
        <Select aria-label="Kategori barang" value={category} onChange={(e) => onCategory(e.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
        <span className="small muted">Barang dengan status ini tidak dapat dipinjam sampai statusnya dipulihkan.</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Barang</th>
              <th>Kategori</th>
              <th>Lokasi</th>
              <th>Status</th>
              <th>Kondisi</th>
              <th>Sejak</th>
              <th>Keterangan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((it) => {
                const mv = since(it.id, it.item_status);
                return (
                  <tr key={it.id}>
                    <td>
                      <Link className="cell-title" href={`/inventaris/${it.id}`}>
                        {it.item_name}
                      </Link>
                      <div className="cell-sub mono">{it.item_code}</div>
                    </td>
                    <td>{cat(it.category_id)?.name}</td>
                    <td>{loc(it.location_id)?.name}</td>
                    <td>
                      <Badge status={it.item_status} />
                    </td>
                    <td>{conditionLabel(it.condition_status)}</td>
                    <td className="nowrap small">{mv ? fmtDate(localDate(mv.at)) : '—'}</td>
                    <td className="small" style={{ maxWidth: 280 }}>
                      {mv?.note || '—'}
                    </td>
                    <td className="right nowrap">
                      <Button size="sm" icon="eye" href={`/inventaris/${it.id}`}>
                        {can('inventory.manage') ? 'Tindak lanjut' : 'Detail'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <Empty icon="checkCircle">Tidak ada barang rusak, dalam perbaikan, atau hilang.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
