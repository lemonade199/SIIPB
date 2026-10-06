/** Laporan: inventaris, peminjaman, pengembalian, keterlambatan, kerusakan & kehilangan. */
import { db } from '@/lib/mock/db';
import { fmtDate, localDate, nowISO } from '@/lib/date';
import { clone, rupiah } from '@/lib/utils';
import { audit } from '@/services/audit';
import { borrowView, cat, emp, item, itemsOf, loc, returnDetails, unit, userName, conditionLabel } from '@/services/lookup';
import { currentUser } from '@/services/session';
import type { Borrowing, Item, ReportFilters, ReportType } from '@/types';

export interface ReportColumn {
  key: string;
  label: string;
  money?: boolean;
  badge?: boolean;
}
export interface Report {
  columns: ReportColumn[];
  rows: Record<string, string | number | undefined>[];
  summary: string;
}

export function buildReport(type: ReportType, f: Partial<ReportFilters> = {}): Report {
  const inRange = (ds: string) => (!f.from || ds >= f.from) && (!f.to || ds <= f.to);
  const empOk = (b: Borrowing | null) => {
    const e = b ? emp(b.employee_id) : null;
    return !f.unit_id || (!!e && e.unit_id === Number(f.unit_id));
  };
  const itemOk = (it: Item) =>
    (!f.category_id || it.category_id === Number(f.category_id)) && (!f.location_id || it.location_id === Number(f.location_id));
  const itemsTxt = (b: Borrowing) => itemsOf(b).map((i) => `${i.item_name} (${i.item_code})`).join('; ');
  const counted = (b: Borrowing) => b.status !== 'DRAF' && b.status !== 'DIBATALKAN';

  if (type === 'inventaris') {
    const rows = db
      .where('items', (it) => it.active && itemOk(it) && (!f.status || it.item_status === f.status))
      .sort((a, b) => a.item_code.localeCompare(b.item_code))
      .map((it) => ({
        kode: it.item_code,
        nama: it.item_name,
        kategori: cat(it.category_id)?.name,
        merek: [it.brand, it.model].filter(Boolean).join(' / '),
        seri: it.serial_number,
        tahun: it.acquisition_year,
        sumber: it.acquisition_source,
        nilai: it.acquisition_value,
        lokasi: loc(it.location_id)?.name,
        kondisi: conditionLabel(it.condition_status),
        status: it.item_status,
      }));
    return {
      columns: [
        { key: 'kode', label: 'Kode' },
        { key: 'nama', label: 'Nama Barang' },
        { key: 'kategori', label: 'Kategori' },
        { key: 'merek', label: 'Merek/Model' },
        { key: 'seri', label: 'No. Seri' },
        { key: 'tahun', label: 'Tahun' },
        { key: 'sumber', label: 'Sumber' },
        { key: 'nilai', label: 'Nilai Perolehan', money: true },
        { key: 'lokasi', label: 'Lokasi' },
        { key: 'kondisi', label: 'Kondisi' },
        { key: 'status', label: 'Status', badge: true },
      ],
      rows,
      summary: `${rows.length} barang · total nilai ${rupiah(rows.reduce((s, r) => s + (Number(r.nilai) || 0), 0))}`,
    };
  }
  if (type === 'peminjaman') {
    const rows = db
      .where('borrowings', (b) => counted(b) && inRange(b.borrow_date) && empOk(b) && (!f.category_id || itemsOf(b).some(itemOk)))
      .sort((a, b) => b.borrow_date.localeCompare(a.borrow_date))
      .map((b) => {
        const e = emp(b.employee_id);
        return {
          kode: b.code,
          peminjam: e?.name,
          unit: unit(e?.unit_id)?.name,
          barang: itemsTxt(b),
          pinjam: fmtDate(b.borrow_date),
          batas: fmtDate(b.due_date),
          status: borrowView(b).display,
          petugas: userName(b.checked_out_by),
        };
      });
    return {
      columns: [
        { key: 'kode', label: 'Kode' },
        { key: 'peminjam', label: 'Peminjam' },
        { key: 'unit', label: 'Unit Kerja' },
        { key: 'barang', label: 'Barang' },
        { key: 'pinjam', label: 'Tgl Pinjam' },
        { key: 'batas', label: 'Batas Kembali' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'petugas', label: 'Petugas' },
      ],
      rows,
      summary: `${rows.length} transaksi peminjaman`,
    };
  }
  if (type === 'pengembalian') {
    const rows = db
      .where('returns', (r) => inRange(r.return_date) && empOk(db.get('borrowings', r.borrowing_id)))
      .sort((a, b) => b.return_date.localeCompare(a.return_date))
      .map((r) => {
        const b = db.get('borrowings', r.borrowing_id)!;
        const e = emp(b.employee_id);
        const det = returnDetails(r)
          .map((d) => `${item(d.item_id)?.item_code}: ${d.condition_after}${d.complete ? '' : ' (tidak lengkap)'}`)
          .join('; ');
        return {
          kode: r.code,
          transaksi: b.code,
          peminjam: e?.name,
          kondisi: det,
          tgl: fmtDate(r.return_date),
          terlambat: r.late_days ? `${r.late_days} hari` : 'Tepat waktu',
          petugas: userName(r.received_by),
        };
      });
    return {
      columns: [
        { key: 'kode', label: 'Kode Kembali' },
        { key: 'transaksi', label: 'Transaksi' },
        { key: 'peminjam', label: 'Peminjam' },
        { key: 'kondisi', label: 'Kondisi Akhir' },
        { key: 'tgl', label: 'Tgl Kembali' },
        { key: 'terlambat', label: 'Keterlambatan' },
        { key: 'petugas', label: 'Diterima Oleh' },
      ],
      rows,
      summary: `${rows.length} pengembalian`,
    };
  }
  if (type === 'keterlambatan') {
    const rows = db
      .where('borrowings', (b) => counted(b) && borrowView(b).lateDays > 0 && inRange(b.due_date) && empOk(b))
      .sort((a, b) => borrowView(b).lateDays - borrowView(a).lateDays)
      .map((b) => {
        const e = emp(b.employee_id);
        const v = borrowView(b);
        const ev = db
          .where('notifications', (n) => n.borrowing_id === b.id && n.event.startsWith('H+'))
          .map((n) => n.event)
          .join(', ');
        return {
          kode: b.code,
          peminjam: e?.name,
          unit: unit(e?.unit_id)?.name,
          barang: itemsTxt(b),
          batas: fmtDate(b.due_date),
          kembali: b.returned_at ? fmtDate(localDate(b.returned_at)) : 'Belum kembali',
          terlambat: `${v.lateDays} hari`,
          status: v.display,
          notifikasi: ev || '—',
        };
      });
    return {
      columns: [
        { key: 'kode', label: 'Kode' },
        { key: 'peminjam', label: 'Peminjam' },
        { key: 'unit', label: 'Unit' },
        { key: 'barang', label: 'Barang' },
        { key: 'batas', label: 'Batas' },
        { key: 'kembali', label: 'Dikembalikan' },
        { key: 'terlambat', label: 'Terlambat' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'notifikasi', label: 'Notifikasi Terkirim' },
      ],
      rows,
      summary: `${rows.length} transaksi terlambat`,
    };
  }
  // kerusakan & kehilangan
  const rows = db
    .where('items', (it) => it.active && ['RUSAK', 'RUSAK_BERAT', 'DALAM_PERBAIKAN', 'HILANG'].includes(it.item_status) && itemOk(it))
    .map((it) => {
      const mv = db
        .where('item_movements', (m) => m.item_id === it.id && m.to_status === it.item_status)
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      return {
        kode: it.item_code,
        nama: it.item_name,
        kategori: cat(it.category_id)?.name,
        lokasi: loc(it.location_id)?.name,
        status: it.item_status,
        kondisi: conditionLabel(it.condition_status),
        sejak: mv ? fmtDate(localDate(mv.at)) : '—',
        keterangan: mv ? mv.note : '',
        nilai: it.acquisition_value,
      };
    });
  return {
    columns: [
      { key: 'kode', label: 'Kode' },
      { key: 'nama', label: 'Nama Barang' },
      { key: 'kategori', label: 'Kategori' },
      { key: 'lokasi', label: 'Lokasi' },
      { key: 'status', label: 'Status', badge: true },
      { key: 'kondisi', label: 'Kondisi' },
      { key: 'sejak', label: 'Sejak' },
      { key: 'keterangan', label: 'Keterangan' },
      { key: 'nilai', label: 'Nilai Perolehan', money: true },
    ],
    rows,
    summary: `${rows.length} barang rusak/perbaikan/hilang`,
  };
}

export function logReport(filters: ReportFilters, format: string, rows: number) {
  db.insert('reports_generated', { type: filters.type, format, rows, filters: clone(filters), user_id: currentUser()!.id, at: nowISO() });
  audit('report.export', 'reports', null, null, { laporan: filters.type, format, baris: rows });
  db.save();
}
