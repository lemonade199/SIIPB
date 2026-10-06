/**
 * Ekspor laporan ke Excel (.xlsx, ExcelJS) dan PDF (jsPDF + AutoTable).
 * Pustaka dimuat dinamis agar tidak memperbesar bundle halaman lain.
 */
import { download } from '@/lib/file';

export interface ExportColumn {
  key: string;
  label: string;
  money?: boolean;
  width?: number;
}

export interface ExportMeta {
  /** Judul utama, mis. "LAPORAN PEMINJAMAN". */
  title: string;
  /** Baris keterangan di bawah judul (instansi, periode, filter). */
  subtitle?: string[];
  /** Ringkasan di bawah tabel. */
  footer?: string;
  sheetName?: string;
}

type Row = Record<string, unknown>;

const cellText = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const money = (v: unknown) => (v === '' || v === null || v === undefined ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID'));

/** Excel .xlsx dengan judul, header tebal, autofilter, kolom uang berformat Rupiah. */
export async function exportXlsx(filename: string, meta: ExportMeta, columns: ExportColumn[], rows: Row[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIIPB';
  wb.created = new Date();
  const ws = wb.addWorksheet((meta.sheetName || 'Laporan').slice(0, 31));
  const cols = [{ key: '_no', label: 'No', width: 6 }, ...columns];
  const lastCol = String.fromCharCode(64 + Math.min(cols.length, 26));

  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = meta.title;
  ws.getCell('A1').font = { bold: true, size: 14 };
  let r = 2;
  for (const line of meta.subtitle || []) {
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    ws.getCell(`A${r}`).value = line;
    ws.getCell(`A${r}`).font = { size: 10, color: { argb: 'FF5B6475' } };
    r++;
  }
  r++;
  const headerRow = ws.getRow(r);
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCDD3DC' } } };
  });
  headerRow.height = 20;
  const headerIndex = r;
  rows.forEach((row, i) => {
    const xr = ws.getRow(++r);
    cols.forEach((c, ci) => {
      const cell = xr.getCell(ci + 1);
      if (c.key === '_no') cell.value = i + 1;
      else if ('money' in c && c.money) {
        const n = row[c.key];
        cell.value = n === '' || n === null || n === undefined ? null : Number(n);
        cell.numFmt = '"Rp" #,##0';
      } else cell.value = row[c.key] === undefined || row[c.key] === null ? '' : (row[c.key] as string | number);
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });
  ws.autoFilter = { from: { row: headerIndex, column: 1 }, to: { row: headerIndex, column: cols.length } };
  ws.views = [{ state: 'frozen', ySplit: headerIndex }];
  cols.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...rows.slice(0, 200).map((row) => cellText(row[c.key]).length));
    ws.getColumn(i + 1).width = c.width ?? Math.min(48, Math.max(10, longest + 2));
  });
  if (meta.footer) {
    r += 2;
    ws.getCell(`A${r}`).value = meta.footer;
    ws.getCell(`A${r}`).font = { italic: true, size: 10 };
  }
  const buf = await wb.xlsx.writeBuffer();
  download(filename, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

/** PDF lanskap A4 dengan kop, tabel bergaris, nomor halaman, dan kolom tanda tangan. */
export async function exportPdf(filename: string, meta: ExportMeta & { signature?: string }, columns: ExportColumn[], rows: Row[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(meta.title, pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of meta.subtitle || []) {
    y += 5;
    doc.text(line, pageW / 2, y, { align: 'center' });
  }
  y += 3;
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [['No', ...columns.map((c) => c.label)]],
    body: rows.map((row, i) => [String(i + 1), ...columns.map((c) => (c.money ? money(row[c.key]) : cellText(row[c.key])))]),
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Halaman ${n}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      doc.text('SIIPB — dokumen dibuat otomatis', 14, doc.internal.pageSize.getHeight() - 8);
      doc.setTextColor(0);
    },
  });
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 10;
  let fy = finalY + 6;
  if (fy > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    fy = 20;
  }
  doc.setFontSize(8.5);
  if (meta.footer) doc.text(meta.footer, 14, fy);
  if (meta.signature) {
    const x = pageW - 70;
    doc.text('Mengetahui,', x, fy + 8);
    doc.text('______________________', x, fy + 30);
    doc.text(meta.signature, x, fy + 35);
  }
  doc.save(filename);
}
