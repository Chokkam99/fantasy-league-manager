import { defineConfig } from '@playwright/test'

const port = 3217
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    {
      name: 'mobile-320',
      use: { viewport: { height: 800, width: 320 } },
    },
    {
      name: 'mobile-390',
      use: { viewport: { height: 844, width: 390 } },
    },
    {
      name: 'desktop-chrome',
      use: { viewport: { height: 900, width: 1280 } },
    },
  ],
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL,
    channel: process.env.CI ? undefined : 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      `E2E=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key ` +
      `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
})
