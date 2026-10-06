import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (UI test) — dokumen Plan bagian 8 & 22.
 * Default: mode mock (tanpa backend). Untuk uji integrasi Flask API jalankan dengan
 * E2E_API=1 dan build frontend memakai NEXT_PUBLIC_DATA_SOURCE=api (lihat README).
 */
const PORT = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1366, height: 860 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
