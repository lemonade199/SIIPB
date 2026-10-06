import { expect, test } from '@playwright/test';
import { login, logout, trackErrors } from './helpers';

test.skip(!!process.env.E2E_API, 'Spesifikasi mode mock');

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
});

test('semua halaman dapat dibuka oleh administrator tanpa error', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin', 'admin123');
  const routes = ['/dashboard', '/inventaris', '/inventaris/1', '/inventaris/1/ubah', '/inventaris/baru', '/peminjaman', '/peminjaman/1', '/peminjaman/baru', '/pengembalian', '/pengembalian/baru', '/pengembalian/1', '/monitoring', '/notifikasi', '/qr?ids=1,2', '/laporan', '/master/peminjam', '/master/kategori', '/master/lokasi', '/master/unit', '/master/parameter', '/pengguna', '/audit', '/pengaturan', '/pengaturan?tab=demo', '/profil'];
  for (const r of routes) {
    await page.goto(r);
    await expect(page.locator('.page-head h1').first(), r).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('RBAC: pimpinan tidak dapat membuka pengaturan dan tidak melihat tombol pencatatan', async ({ page }) => {
  await login(page, 'pimpinan', 'pimpinan123');
  await page.goto('/pengaturan');
  await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
  await page.goto('/peminjaman');
  await expect(page.getByRole('link', { name: 'Catat Peminjaman' })).toHaveCount(0);
});

test('alur peminjaman → pengembalian rusak', async ({ page }) => {
  await login(page, 'petugas', 'petugas123');
  await page.goto('/peminjaman/baru');
  await page.getByRole('radio').first().check();
  const scan = page.getByLabel('Pindai / ketik kode barang');
  await scan.fill('INV-MMD-0002');
  await scan.press('Enter');
  await scan.fill('INV-ALT-0001');
  await scan.press('Enter');
  await expect(page.getByText(/INV-ALT-0001 tidak dapat dipinjam/)).toBeVisible();
  await page.getByLabel('Tujuan peminjaman').fill('Uji otomatis');
  await page.getByRole('button', { name: /Simpan & Serahkan/ }).click();
  await expect(page).toHaveURL(/\/peminjaman\/\d+$/);
  await expect(page.locator('.kv .badge').first()).toHaveText(/JATUH TEMPO|DIPINJAM/);
  const id = page.url().split('/').pop();

  await page.goto(`/pengembalian/baru?pinjam=${id}`);
  await page.getByLabel('Kondisi akhir').first().selectOption('RUSAK');
  await page.getByLabel('Keterangan kerusakan').fill('Lensa tergores');
  await page.getByRole('button', { name: 'Simpan Pengembalian' }).click();
  await expect(page).toHaveURL(/\/pengembalian\/\d+$/);
  await expect(page.locator('tbody .badge').last()).toHaveText('RUSAK');
});

test('mode demo +3 hari menandai transaksi terlambat', async ({ page }) => {
  await login(page, 'admin', 'admin123');
  await page.goto('/pengaturan?tab=demo');
  await page.getByRole('button', { name: '+3 hari' }).click();
  await expect(page.locator('.topbar .date-chip')).toContainText('demo +3');
  await page.goto('/monitoring?tab=terlambat');
  await expect(page.locator('tbody tr').first()).toContainText('TERLAMBAT');
});

test('monitoring rusak/hilang & parameter status/kondisi', async ({ page }) => {
  await login(page, 'admin', 'admin123');
  await page.goto('/monitoring');
  await page.getByRole('tab', { name: /Rusak \/ hilang/ }).click();
  await expect(page.getByText('INV-ALT-0001')).toBeVisible();
  await expect(page.getByText('INV-KOM-0005')).toBeVisible();

  await page.goto('/master/parameter');
  await page.getByRole('button', { name: 'Ubah BAIK' }).click();
  await page.getByRole('dialog').getByLabel('Label tampilan').fill('Prima');
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
  await page.goto('/inventaris/1');
  await expect(page.locator('.kv').first()).toContainText('Prima');
});

test('barang dengan banyak foto', async ({ page }) => {
  await login(page, 'petugas', 'petugas123');
  await page.goto('/inventaris/1/ubah');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.getByLabel('Pilih foto barang').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: png },
    { name: 'b.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.getByRole('listitem').filter({ has: page.locator('img') })).toHaveCount(2);
  await page.getByRole('button', { name: 'Simpan perubahan' }).click();
  await expect(page).toHaveURL(/\/inventaris\/1$/);
  await expect(page.getByText('2 foto')).toBeVisible();
});

test('laporan dapat diunduh sebagai Excel (.xlsx) dan PDF', async ({ page }) => {
  await login(page, 'petugas', 'petugas123');
  await page.goto('/laporan?type=inventaris');
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Unduh Excel/ }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Unduh PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await logout(page);
});
