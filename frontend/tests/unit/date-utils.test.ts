import { describe, expect, it } from 'vitest';
import { addDays, diffDays, fmtDate, relDue } from '@/lib/date';
import { initials, match, paginate, rupiah } from '@/lib/utils';
import { toCSV } from '@/lib/file';

describe('lib/date', () => {
  it('menghitung selisih hari kalender', () => {
    expect(diffDays('2026-10-01', '2026-10-06')).toBe(5);
    expect(diffDays('2026-10-06', '2026-10-01')).toBe(-5);
    expect(diffDays('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('menambah hari termasuk lintas bulan/tahun', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('memberi label H-n / H / H+n relatif terhadap tanggal acuan', () => {
    expect(relDue('2026-10-09', '2026-10-06')).toMatchObject({ label: 'H-3', n: 3 });
    expect(relDue('2026-10-06', '2026-10-06')).toMatchObject({ label: 'H', text: 'Hari ini' });
    expect(relDue('2026-10-01', '2026-10-06')).toMatchObject({ label: 'H+5', text: 'Terlambat 5 hari' });
  });

  it('memformat tanggal Indonesia', () => {
    expect(fmtDate('2026-10-06')).toBe('6 Okt 2026');
    expect(fmtDate('2026-10-06', true)).toBe('Selasa, 6 Oktober 2026');
    expect(fmtDate(null)).toBe('—');
  });
});

describe('lib/utils', () => {
  it('paginate membatasi halaman di rentang valid', () => {
    const p = paginate(Array.from({ length: 23 }, (_, i) => i), 9, 10);
    expect(p).toMatchObject({ page: 3, pages: 3, from: 21, to: 23, total: 23 });
    expect(p.rows).toEqual([20, 21, 22]);
    expect(paginate([], 1, 10)).toMatchObject({ from: 0, to: 0, pages: 1 });
  });

  it('match mencari tanpa peka huruf besar/kecil', () => {
    expect(match('think', 'Lenovo ThinkPad')).toBe(true);
    expect(match('xyz', 'a', null, undefined)).toBe(false);
    expect(match('', 'apa saja')).toBe(true);
  });

  it('format rupiah & inisial', () => {
    expect(rupiah(14500000)).toBe('Rp 14.500.000');
    expect(rupiah('')).toBe('—');
    expect(initials('Rina Kartika Dewi')).toBe('RK');
  });

  it('toCSV memakai pemisah titik koma, BOM, dan meng-escape nilai', () => {
    const csv = toCSV([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 'x;y', b: 'say "hi"' }]);
    expect(csv.startsWith('﻿A;B')).toBe(true);
    expect(csv).toContain('"x;y";"say ""hi"""');
  });
});
