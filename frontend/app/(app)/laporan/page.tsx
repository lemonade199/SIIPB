'use client';

import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, nowISO, parseDate, toDateStr, today } from '@/lib/date';
import { ITEM_STATUS, REPORTS } from '@/lib/constants';
import { exportPdf, exportXlsx } from '@/lib/export';
import { rupiah } from '@/lib/utils';
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
import type { ReportFilters, ReportType } from '@/types';
import { TableWrap } from '@/components/ui/table-wrap';

function defaultFrom() {
  const d = parseDate(today());
  d.setMonth(d.getMonth() - 2);
  d.setDate(1);
  return toDateStr(d);
}


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
    from: defaultFrom(),
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
  const periodText = posisi ? `Posisi per ${fmtDate(today(), true)}` : `Periode ${f.from ? fmtDate(f.from) : 'awal'} s.d. ${f.to ? fmtDate(f.to) : 'sekarang'}`;
  const filt = [
    f.unit_id ? `Unit: ${unit(Number(f.unit_id))?.name}` : '',
    f.category_id ? `Kategori: ${cat(Number(f.category_id))?.name}` : '',
    f.location_id ? `Lokasi: ${loc(Number(f.location_id))?.name}` : '',
    f.status ? `Status: ${f.status}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hist = db.all('reports_generated').slice(-6).reverse();
  const s = db.data.settings;

  const cell = (c: ReportColumn, v: string | number | undefined) => {
    if (TEXT_COLS.has(c.key) && v) return <div className="clamp-2">{v}</div>;
    if (c.badge) return <Badge status={String(v)} />;
    if (c.money) return rupiah(v);
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
        <PageHead crumb="Beranda / Laporan" title="Laporan" desc="Rekap inventaris dan transaksi — unduh PDF, Excel, atau cetak langsung." />
        <div className="grid g-auto mb-[18px]">
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
                <StatIcon icon={r.icon} tone="primary" size={18} />
                <span className="strong" style={{ fontSize: 15 }}>
                  {r.label}
                </span>
                <span className="stat-sub">{r.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="split report-split">
        <section className="card">
          <div className="toolbar no-print">
            {!posisi && (
              <span className="row" style={{ gap: 8 }}>
                <label className="small muted" htmlFor="rp-from">
                  Dari
                </label>
                <Input type="date" id="rp-from" value={f.from} onChange={(e) => set('from', e.target.value)} />
                <label className="small muted" htmlFor="rp-to">
                  s.d.
                </label>
                <Input type="date" id="rp-to" value={f.to} onChange={(e) => set('to', e.target.value)} />
              </span>
            )}
            <Select aria-label="Unit kerja" value={f.unit_id} onChange={(e) => set('unit_id', e.target.value)} options={toOptions(db.all('units'), 'Semua unit kerja')} />
            <Select aria-label="Kategori" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
            <Select aria-label="Lokasi" value={f.location_id} onChange={(e) => set('location_id', e.target.value)} options={toOptions(db.all('locations'), 'Semua lokasi')} />
            {f.type === 'inventaris' && (
              <Select
                aria-label="Status barang"
                value={f.status}
                onChange={(e) => set('status', e.target.value)}
                options={[{ value: '', label: 'Semua status' }, ...ITEM_STATUS.map((x) => ({ value: x, label: x }))]}
              />
            )}
          </div>
          <div className="card-body">
            <div className="report-head print-only">
              <div style={{ fontSize: 12 }}>
                {s.institution} — {s.unit_sarpras}
              </div>
              <h2 style={{ margin: '6px 0' }}>LAPORAN {meta.label.toUpperCase()}</h2>
              <div style={{ fontSize: 12 }}>
                {periodText}
                {filt && ` · ${filt}`}
              </div>
            </div>
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
                          <td key={c.key} className={c.money || NOWRAP_COLS.has(c.key) ? 'nowrap' : TEXT_COLS.has(c.key) ? 'text-col' : undefined}>
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
            <div className="print-only" style={{ marginTop: 12, fontSize: 11 }}>
              {rep.summary} · Dicetak {fmtDateTime(nowISO())} oleh {user.name}
            </div>
            <div className="print-only" style={{ marginTop: 36, textAlign: 'right', fontSize: 12 }}>
              Mengetahui,
              <br />
              <br />
              <br />
              <br />
              ______________________
              <br />
              Pimpinan
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
                <p className="small muted">
                  {isApiMode
                    ? 'PDF (A4 lanskap, kop & tanda tangan) dibuat server dengan WeasyPrint dan Excel (.xlsx, filter & format Rupiah) dengan openpyxl; setiap unduhan tercatat di audit log.'
                    : 'PDF (A4 lanskap, dengan kop & kolom tanda tangan) dan Excel (.xlsx, dengan filter & format Rupiah) dibuat langsung di browser (mode demo).'}
                </p>
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
