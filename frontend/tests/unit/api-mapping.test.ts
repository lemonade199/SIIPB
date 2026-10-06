/** Pemetaan DTO Flask API → model frontend (mode api). Contoh DTO diambil dari respons backend nyata. */
import { describe, expect, it } from 'vitest';
import { mapAsset, mapBorrowing, mapPermissions, mapReturn, photoUrl } from '@/services/api/sync';
import type { ApiAsset, ApiBorrowing, ApiReturn } from '@/services/api/endpoints';

const asset: ApiAsset = {
  id: 5,
  inventory_code: 'AST-TKJ-001',
  name: 'Fluke Network Cable Tester Kit',
  brand: 'Fluke Networks',
  model: 'MicroScanner2',
  serial_number: 'FLK-440192',
  description: null,
  photo_path: '/uploads/assets/abc.jpg',
  purchase_date: '2023-03-12',
  acquisition_cost: 9200000,
  status: 'TERSEDIA',
  condition: 'BAIK',
  category_id: 4,
  category_name: 'Perkakas & Jaringan',
  location_id: 3,
  location_name: 'Laboratorium Jaringan TKJ',
  owner_unit_id: 3,
  owner_unit_name: 'Jurusan TKJ',
  is_active: true,
  created_at: '2026-10-06T15:27:17.429493',
  updated_at: null,
};

describe('mapAsset', () => {
  it('memetakan field aset ke item', () => {
    const it0 = mapAsset(asset);
    expect(it0).toMatchObject({ id: 5, item_code: 'AST-TKJ-001', item_name: 'Fluke Network Cable Tester Kit', acquisition_year: 2023, acquisition_value: 9200000, item_status: 'TERSEDIA', active: true });
    expect(it0.photos[0]).toMatch(/^http.*\/uploads\/assets\/abc\.jpg$/);
  });

  it('status NONAKTIF dari backend menjadi barang nonaktif', () => {
    const it0 = mapAsset({ ...asset, status: 'NONAKTIF' });
    expect(it0.active).toBe(false);
    expect(it0.item_status).toBe('TERSEDIA');
  });

  it('photoUrl tidak mengubah URL absolut', () => {
    expect(photoUrl('https://cdn.contoh.id/a.jpg')).toBe('https://cdn.contoh.id/a.jpg');
    expect(photoUrl(null)).toBeNull();
  });
});

describe('mapBorrowing & mapReturn', () => {
  const b: ApiBorrowing = {
    id: 1,
    transaction_number: 'TX-20261006152735-B38E',
    borrower_id: 1,
    borrower: { id: 1, name: 'Ahmad Pratama', identity_number: 'NISN-0051234567', email: 'a@b.id', phone: null },
    handled_by: 1,
    handler_name: 'Administrator SIIPB',
    borrowed_at: '2026-10-06T15:27:35',
    start_date: '2026-10-06',
    due_date: '2026-10-09',
    status: 'AKTIF',
    purpose: 'Uji',
    notes: null,
    items: [{ id: 11, asset_id: 5, asset_name: 'x', inventory_code: 'AST', checked_out_at: null }],
    created_at: '2026-10-06T15:27:35',
  };

  it('status AKTIF → DIPINJAM dan detail memakai id borrowing_item', () => {
    const m = mapBorrowing(b);
    expect(m.borrowing).toMatchObject({ code: b.transaction_number, status: 'DIPINJAM', borrow_date: '2026-10-06', due_date: '2026-10-09', employee_id: 1 });
    expect(m.details[0]).toMatchObject({ id: 11, item_id: 5 });
  });

  it('pengembalian: RUSAK berat → RUSAK_BERAT, keterlambatan dihitung dari batas', () => {
    const r: ApiReturn = {
      id: 3,
      borrowing_id: 1,
      transaction_number: b.transaction_number,
      received_by: 1,
      receiver_name: 'Admin',
      returned_at: '2026-10-12T10:00:00',
      notes: null,
      created_at: '2026-10-12T10:00:00',
      items: [
        { id: 1, borrowing_item_id: 11, asset_id: 5, asset_name: 'x', inventory_code: 'AST', final_condition: 'RUSAK', completeness: 'Tidak lengkap: charger', notes: null, damage_report: { id: 1, severity: 'BERAT', description: 'Pecah', repair_cost: null, repair_status: 'DILAPORKAN' }, loss_report: null },
      ],
    };
    const m = mapReturn(r, mapBorrowing(b).borrowing);
    expect(m.ret.late_days).toBe(3);
    expect(m.details[0]).toMatchObject({ condition_after: 'RUSAK_BERAT', complete: false, damage_note: 'Pecah' });
  });
});

describe('mapPermissions', () => {
  it('ADMIN mendapat seluruh izin', () => {
    expect(mapPermissions({ roles: ['ADMIN'], permissions: [] })).toContain('settings.manage');
  });

  it('SARPRAS dipetakan dari permission backend', () => {
    const p = mapPermissions({ roles: ['SARPRAS'], permissions: ['asset.view', 'asset.create', 'borrowing.create', 'borrowing.return', 'report.view'] });
    expect(p).toEqual(expect.arrayContaining(['inventory.view', 'inventory.manage', 'borrowing.manage', 'return.manage', 'report.export']));
    expect(p).not.toContain('settings.manage');
    expect(p).not.toContain('users.manage');
  });
});
