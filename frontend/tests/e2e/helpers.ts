import { expect, type Page } from '@playwright/test';

export async function login(page: Page, username: string, password: string) {
  if (process.env.E2E_API) {
    // gambar CAPTCHA tidak bisa dibaca tes; backend uji (APP_ENV=testing) tidak mewajibkannya bila tidak dikirim
    await page.unroute('**/api/v1/auth/login');
    await page.route('**/api/v1/auth/login', async (route) => {
      const body = route.request().postDataJSON() ?? {};
      delete body.captcha_id;
      delete body.captcha_answer;
      await route.continue({ postData: JSON.stringify(body) });
    });
  }
  await page.goto('/login');
  await page.getByLabel('Username atau email').fill(username);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-captcha').fill('AAAAAA');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Keluar' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Kumpulkan error konsol & JS selama tes. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(m.text());
  });
  return errors;
}
