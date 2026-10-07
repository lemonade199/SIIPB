/**
 * Uji integrasi frontend ↔ Flask REST API (alur utama dokumen Plan).
 * Prasyarat: backend berjalan dengan database hasil `alembic upgrade head` + `scripts/seed_data.py`,
 * frontend dibuild dengan NEXT_PUBLIC_DATA_SOURCE=api, lalu:
 *   E2E_API=1 npx playwright test tests/e2e/api.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { login, logout, trackErrors } from './helpers';

test.skip(!process.env.E2E_API, 'Set E2E_API=1 untuk menjalankan uji integrasi API');
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString().slice(-6);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function createAsset(page: Page, name: string) {
  await page.goto('/inventaris/baru');
  await page.getByLabel('Nama barang').fill(name);
  await page.getByLabel('Kategori').selectOption({ index: 1 });
  await page.getByLabel('Lokasi').selectOption({ index: 1 });
  await page.getByLabel('Tahun perolehan').fill('2024');
  await page.getByLabel('Sumber perolehan').fill('Hibah');
  return page.url();
}

test('barang dengan foto, tahun & sumber perolehan; ubah status manual', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin', 'admin123');
  await createAsset(page, `Proyektor E2E ${stamp}`);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page).toHaveURL(/\/inventaris\/\d+$/, { timeout: 20_000 });
  await expect(page.getByText('Hibah')).toBeVisible();
  await expect(page.locator('img[src*="/uploads/assets/"]').first()).toBeVisible();
  // status manual: rusak -> tersedia
  await page.getByRole('button', { name: /Ubah status/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Status baru').selectOption('DALAM_PERBAIKAN');
  await dlg.getByRole('button', { name: /Simpan/ }).click();
  await expect(page.locator('.kv .badge').first()).toHaveText(/PERBAIKAN/, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('draf → checkout → pengembalian rusak, email tercatat', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'petugas', 'petugas123');
  await createAsset(page, `Laptop E2E ${stamp}`);
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page).toHaveURL(/\/inventaris\/\d+$/, { timeout: 20_000 });
  const assetId = page.url().split('/').pop();

  await page.goto(`/peminjaman/baru?item=${assetId}`);
  await page.getByLabel('Cari peminjam dari master data').fill('Andi');
  await page.getByRole('radio').first().check();
  await page.getByLabel('Tujuan peminjaman').fill('Rapat koordinasi');
  await page.getByRole('button', { name: /draf/i }).click();
  await expect(page).toHaveURL(/\/peminjaman\/\d+$/, { timeout: 20_000 });
  await expect(page.locator('.page-head h1')).toHaveText(/^PJM-\d{4}-\d{4}$/);
  await expect(page.getByText('masih DRAF', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Checkout / Serahkan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Checkout' }).click();
  await expect(page.locator('.timeline').getByText('Konfirmasi peminjaman')).toBeVisible({ timeout: 20_000 });
  const bid = page.url().split('/').pop();

  await page.goto(`/pengembalian/baru?pinjam=${bid}`);
  await page.getByLabel('Kondisi akhir').first().selectOption('DALAM_PERBAIKAN');
  await page.getByLabel('Keterangan kerusakan').fill('Engsel layar longgar');
  await page.getByRole('button', { name: 'Simpan Pengembalian' }).click();
  await expect(page).toHaveURL(/\/pengembalian\/\d+$/, { timeout: 20_000 });
  await expect(page.locator('tbody .badge').last()).toHaveText(/PERBAIKAN/);

  await page.goto(`/peminjaman/${bid}`);
  await expect(page.locator('.timeline').getByText('Konfirmasi pengembalian')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('admin: pengguna, role, pengaturan, scheduler, laporan, audit', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin', 'admin123');

  // pengguna baru
  await page.goto('/pengguna');
  await page.getByRole('button', { name: 'Tambah pengguna' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nama lengkap').fill(`Staf E2E ${stamp}`);
  await dlg.getByLabel('Username').fill(`staf${stamp}`);
  await dlg.getByLabel('Email').fill(`staf${stamp}@contoh.id`);
  await dlg.getByLabel('Kata sandi awal').fill('Rahasia123');
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(`Staf E2E ${stamp}`)).toBeVisible({ timeout: 15_000 });

  // pengaturan umum
  await page.goto('/pengaturan?tab=umum');
  await page.getByLabel('Nama instansi').fill(`Instansi E2E ${stamp}`);
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.locator('.toast').last()).toContainText('disimpan');
  await page.reload();
  await expect(page.getByLabel('Nama instansi')).toHaveValue(`Instansi E2E ${stamp}`, { timeout: 15_000 });

  // scheduler manual
  await page.goto('/notifikasi');
  await page.getByRole('button', { name: /Jalankan/ }).first().click();
  await expect(page.locator('.toast').last()).toContainText('Pemeriksaan selesai', { timeout: 15_000 });

  // laporan PDF & Excel dari server
  await page.goto('/laporan?type=inventaris');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Unduh PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^laporan-inventaris-.*\.pdf$/);
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Unduh Excel/ }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);

  // audit log memuat aktivitas
  await page.goto('/audit');
  await expect(page.locator('tbody tr').first()).toBeVisible();

  await logout(page);
  // pengguna baru dapat login
  await login(page, `staf${stamp}`, 'Rahasia123');
  await logout(page);
  expect(errors).toEqual([]);
});

test('pimpinan hanya-baca', async ({ page }) => {
  await login(page, 'pimpinan', 'pimpinan123');
  await page.goto('/inventaris');
  await expect(page.getByRole('link', { name: /Tambah barang/i })).toHaveCount(0);
  await page.goto('/pengguna');
  await expect(page.getByText(/tidak memiliki akses|403/i).first()).toBeVisible();
});
