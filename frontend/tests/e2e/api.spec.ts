/**
 * Uji integrasi frontend ↔ Flask REST API.
 * Prasyarat: backend berjalan + seed (scripts/seed_data.py), frontend dibuild dengan
 * NEXT_PUBLIC_DATA_SOURCE=api, lalu: E2E_API=1 npx playwright test tests/e2e/api.spec.ts
 */
import { expect, test } from '@playwright/test';
import { login, logout, trackErrors } from './helpers';

test.skip(!process.env.E2E_API, 'Set E2E_API=1 untuk menjalankan uji integrasi API');

test('login JWT, barang, peminjam, peminjaman, pengembalian lewat API', async ({ page }) => {
  const errors = trackErrors(page);
  const stamp = Date.now().toString().slice(-6);
  await login(page, 'admin', 'admin123');

  await page.goto('/inventaris/baru');
  await page.getByLabel('Nama barang').fill(`Barang E2E ${stamp}`);
  await page.getByLabel('Kategori').selectOption({ index: 1 });
  await page.getByLabel('Lokasi').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Simpan barang' }).click();
  await expect(page).toHaveURL(/\/inventaris\/\d+$/, { timeout: 20_000 });
  const assetId = page.url().split('/').pop();

  await page.goto('/master/peminjam');
  await page.getByRole('button', { name: 'Tambah peminjam' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('NIP / nomor induk').fill(`E2E-${stamp}`);
  await dlg.getByLabel('Nama lengkap').fill(`Peminjam E2E ${stamp}`);
  await dlg.getByLabel('Unit kerja').selectOption({ index: 1 });
  await dlg.getByLabel('Email').fill(`e2e${stamp}@contoh.id`);
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(`Peminjam E2E ${stamp}`)).toBeVisible();

  await page.goto(`/peminjaman/baru?item=${assetId}`);
  await page.getByLabel('Cari peminjam dari master data').fill(`Peminjam E2E ${stamp}`);
  await page.getByRole('radio').first().check();
  await page.getByLabel('Tujuan peminjaman').fill('Uji integrasi');
  await expect(page.getByRole('button', { name: /draf/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Simpan & Serahkan/ }).click();
  await expect(page).toHaveURL(/\/peminjaman\/\d+$/, { timeout: 20_000 });
  await expect(page.locator('.page-head h1')).toHaveText(/^TX-/);
  const bid = page.url().split('/').pop();

  await page.goto(`/pengembalian/baru?pinjam=${bid}`);
  await page.getByLabel('Kondisi akhir').first().selectOption('BAIK');
  await page.getByRole('button', { name: 'Simpan Pengembalian' }).click();
  await expect(page).toHaveURL(/\/pengembalian\/\d+$/, { timeout: 20_000 });
  await expect(page.locator('tbody .badge').last()).toHaveText('TERSEDIA');

  await page.reload();
  await expect(page.locator('.page-head h1')).toBeVisible({ timeout: 20_000 });
  await logout(page);
  expect(errors).toEqual([]);
});
