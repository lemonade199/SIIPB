'use client';

import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, nowISO, today } from '@/lib/date';
import { ITEM_STATUS, REPORTS } from '@/lib/constants';
import { exportPdf, exportXlsx } from '@/lib/export';
import { fmtNumber } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, StatIcon } from '@/components/ui/card';
import { Select, toOptions } from '@/components/ui/form';
import { Empty, PageHead } from '@/components/ui/misc';
import { useToast } from '@/components/providers/feedback-provider';
import { cat, loc, unit, userName } from '@/services/lookup';
import { buildReport, logReport, type ReportColumn } from '@/services/report';
import * as repo from '@/services/repo';
import { isApiMode } from '@/lib/config';
import type { ID, ReportFilters, ReportType } from '@/types';
import { TableWrap } from '@/components/ui/table-wrap';
import { PrintHeader, PrintSign } from '@/components/domain/print-doc';


/** Kolom pendek (kode, tanggal, angka) tidak dipecah ke baris baru; kolom teks panjang dibatasi 2 baris. */
const NOWRAP_COLS = new Set(['kode', 'transaksi', 'pinjam', 'batas', 'kembali', 'tgl', 'sejak', 'seri', 'tahun', 'terlambat', 'status']);
const TEXT_COLS = new Set(['barang', 'nama', 'keterangan', 'merek']);
export default function LaporanPage() {
  useTitle('Laporan');
  const { user, can } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [f, setF] = usePersistentState<ReportFilters>('rp.filter', {
    type: 'peminjaman',
    from: '',
    to: '',
    unit_id: '',
    category_id: '',
    location_id: '',
    status: '',
  });
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const [busy, setBusy] = useState<'' | 'pdf' | 'xlsx'>('');

  useEffect(() => {
    const t = params.get('type') as ReportType | null;
    if (t && REPORTS[t]) setF((p) => ({ ...p, type: t }));
  }, [params, setF]);

  if (!user) return null;
  const rep = buildReport(f.type, f);
  const meta = REPORTS[f.type];
  const posisi = f.type === 'inventaris' || f.type === 'kerusakan';
  const periodText = posisi
    ? `Posisi per ${fmtDate(today(), true)}`
    : !f.from && !f.to
      ? 'Semua periode'
      : `Periode ${f.from ? fmtDate(f.from) : 'awal'} s.d. ${f.to ? fmtDate(f.to) : 'sekarang'}`;
  const filt = [
    f.unit_id ? `Unit: ${unit(Number(f.unit_id))?.name}` : '',
    f.category_id ? `Kategori: ${cat(Number(f.category_id))?.name}` : '',
    f.location_id ? `Lokasi: ${loc(Number(f.location_id))?.name}` : '',
    f.status ? `Status: ${f.status}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // Mode api: riwayat diambil dari audit log server (unduhan PDF/Excel tercatat di sana);
  // tanpa izin audit, dipakai catatan sesi di browser.
  const hist: { id: ID; type: ReportType; format: string; rows: number; user_id: ID; at: string }[] =
    isApiMode && can('audit.view')
      ? db
          .all('activity_logs')
          .filter((a) => a.action === 'report.export')
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((a) => {
            const v = (a.new_value || {}) as { type?: string; format?: string; rows?: number };
            const format = v.format === 'pdf' ? 'PDF' : v.format === 'xlsx' ? 'Excel' : String(v.format || '');
            return { id: a.id, type: v.type as ReportType, format, rows: Number(v.rows || 0), user_id: a.user_id, at: a.at };
          })
          .filter((h) => h.type in REPORTS)
          .slice(0, 6)
      : db.all('reports_generated').slice(-6).reverse();
  const s = db.data.settings;

  const cell = (c: ReportColumn, v: string | number | undefined) => {
    if (TEXT_COLS.has(c.key) && v) return <div className="clamp-2">{v}</div>;
    if (c.badge) return <Badge status={String(v)} />;
    if (c.numeric) return fmtNumber(v);
    return v === '' || v === undefined || v === null ? '—' : v;
  };

  const exportMeta = {
    title: `LAPORAN ${meta.label.toUpperCase()}`,
    subtitle: [`${s.institution} — ${s.unit_sarpras}`, `${periodText}${filt ? ` · ${filt}` : ''}`],
    footer: `${rep.summary} · Dicetak ${fmtDateTime(nowISO())} oleh ${user.name}`,
    sheetName: meta.label,
  };
  const doPrint = () => {
    logReport(f, 'Cetak', rep.rows.length);
    setTimeout(() => window.print(), 50);
  };
  const doPdf = async () => {
    setBusy('pdf');
    try {
      if (isApiMode) {
        const r = await repo.exportReport(f, 'pdf');
        if (!r.ok) throw new Error(r.error);
      } else await exportPdf(`laporan-${f.type}-${today()}.pdf`, { ...exportMeta, signature: 'Pimpinan' }, rep.columns, rep.rows);
      logReport(f, 'PDF', rep.rows.length);
      toast('Laporan PDF diunduh.');
    } catch (e) {
      toast(`Gagal membuat PDF: ${(e as Error).message}`, 'err');
    } finally {
      setBusy('');
    }
  };
  const doXlsx = async () => {
    setBusy('xlsx');
    try {
      if (isApiMode) {
        const r = await repo.exportReport(f, 'xlsx');
        if (!r.ok) throw new Error(r.error);
      } else await exportXlsx(`laporan-${f.type}-${today()}.xlsx`, exportMeta, rep.columns, rep.rows);
      logReport(f, 'Excel', rep.rows.length);
      toast('Laporan Excel (.xlsx) diunduh.');
    } catch (e) {
      toast(`Gagal membuat Excel: ${(e as Error).message}`, 'err');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="no-print">
        <PageHead crumb="Beranda / Laporan" title="Laporan" />
        <div className="report-types mb-[18px]">
          {(Object.keys(REPORTS) as ReportType[]).map((k) => {
            const r = REPORTS[k];
            const on = f.type === k;
            return (
              <button
                key={k}
                type="button"
                className="card stat"
                aria-pressed={on}
                onClick={() => set('type', k)}
                style={{ textAlign: 'left', font: 'inherit', color: 'inherit', borderColor: on ? 'var(--primary)' : undefined, background: on ? 'var(--primary-soft)' : undefined }}
              >
                <StatIcon icon={r.icon} tone="primary" size={16} />
                <span className="strong" style={{ fontSize: 14 }}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="split report-split">
        <section className="card">
          <div className="report-filters no-print">
            {!posisi && (
              <>
                <label className="rf">
                  <span>Dari tanggal</span>
                  <Input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} />
                </label>
                <label className="rf">
                  <span>Sampai tanggal</span>
                  <Input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} />
                </label>
              </>
            )}
            <label className="rf">
              <span>Unit kerja</span>
              <Select className="w-full" value={f.unit_id} onChange={(e) => set('unit_id', e.target.value)} options={toOptions(db.all('units'), 'Semua unit kerja')} />
            </label>
            <label className="rf">
              <span>Kategori</span>
              <Select className="w-full" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
            </label>
            <label className="rf">
              <span>Lokasi</span>
              <Select className="w-full" value={f.location_id} onChange={(e) => set('location_id', e.target.value)} options={toOptions(db.all('locations'), 'Semua lokasi')} />
            </label>
            {f.type === 'inventaris' && (
              <label className="rf">
                <span>Status barang</span>
                <Select
                  className="w-full"
                  value={f.status}
                  onChange={(e) => set('status', e.target.value)}
                  options={[{ value: '', label: 'Semua status' }, ...ITEM_STATUS.map((x) => ({ value: x, label: x }))]}
                />
              </label>
            )}
          </div>
          <div className="card-body">
            <PrintHeader title={`Laporan ${meta.label}`} subtitle={`${periodText}${filt ? ` · ${filt}` : ''}`} />
            <div className="row between no-print" style={{ marginBottom: 10 }}>
              <div>
                <div className="strong">Laporan {meta.label}</div>
                <div className="small muted">
                  {periodText}
                  {filt && ` · ${filt}`} · {rep.summary}
                </div>
              </div>
            </div>
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    {rep.columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rep.rows.length ? (
                    rep.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{i + 1}</td>
                        {rep.columns.map((c) => (
                          <td key={c.key} className={c.numeric || NOWRAP_COLS.has(c.key) ? 'nowrap' : TEXT_COLS.has(c.key) ? 'text-col' : undefined}>
                            {cell(c, r[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={rep.columns.length + 1}>
                        <Empty icon="file">Tidak ada data untuk parameter ini.</Empty>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableWrap>
            <div className="print-only print-doc">
              <div className="pd-foot">
                {rep.summary} · Dicetak {fmtDateTime(nowISO())} oleh {user.name}
              </div>
              <PrintSign
                cols={[
                  { role: 'Mengetahui,\nPimpinan' },
                  { role: 'Petugas Sarpras/IT,', name: user.name },
                ]}
              />
            </div>
          </div>
        </section>
        <div className="stack no-print">
          <Card title="Unduh / cetak">
            {can('report.export') ? (
              <div className="stack" style={{ gap: 8 }}>
                <Button variant="primary" icon="download" block disabled={!!busy} onClick={doPdf}>
                  {busy === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF'}
                </Button>
                <Button icon="download" block disabled={!!busy} onClick={doXlsx}>
                  {busy === 'xlsx' ? 'Membuat Excel…' : 'Unduh Excel (.xlsx)'}
                </Button>
                <Button icon="printer" block onClick={doPrint}>
                  Cetak
                </Button>
              </div>
            ) : (
              <p className="small muted">Peran Anda hanya dapat melihat laporan.</p>
            )}
          </Card>
          <Card title="Laporan terakhir">
            {hist.length ? (
              <ul className="list">
                {hist.map((h) => (
                  <li key={h.id}>
                    <StatIcon icon={h.format === 'Cetak' ? 'printer' : 'download'} tone="gray" size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small strong">
                        {REPORTS[h.type].label} · {h.format}
                      </div>
                      <div className="cell-sub">
                        {fmtDateTime(h.at)} · {userName(h.user_id)} · {h.rows} baris
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Belum ada laporan yang dibuat.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
