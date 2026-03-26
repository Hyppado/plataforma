/**
 * playwright.config.ts — E2E test configuration
 *
 * Smoke tests run against a local dev server started automatically.
 * In CI, the server uses mock env vars (no real DB needed for public pages).
 *
 * Usage:
 *   npm run test:e2e           — run all E2E tests
 *   npm run test:e2e -- --ui   — open Playwright UI
 *   npm run test:e2e -- --debug — debug a specific test
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Parallel in local, sequential in CI for stability
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [["list"] as const, ["github"] as const]
    : [["list"] as const],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Automatically start `next dev` before running E2E tests.
  // For CI: webServer uses mock env vars set in the workflow.
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // stdout visible in CI for debugging
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      // Safe dummy values so Next.js starts without real credentials
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://test:test@localhost:5432/hyppado_test",
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ?? "e2e-test-secret-minimum-32-chars-ok",
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_ADMIN_MODE: "false",
      HOTMART_CLIENTE_ID: process.env.HOTMART_CLIENTE_ID ?? "e2e-ci-id",
      HOTMART_CLIENT_SECRET:
        process.env.HOTMART_CLIENT_SECRET ?? "e2e-ci-secret",
      HOTMART_BASIC:
        process.env.HOTMART_BASIC ?? "ZTJlLWNpLWlkOmUyZS1jaS1zZWNyZXQ=",
      HOTMART_WEBHOOK_SECRET:
        process.env.HOTMART_WEBHOOK_SECRET ?? "e2e-webhook-secret",
      ECHOTIK_BASE_URL:
        process.env.ECHOTIK_BASE_URL ?? "https://echotik.test.local",
      ECHOTIK_USERNAME: process.env.ECHOTIK_USERNAME ?? "e2e-user",
      ECHOTIK_PASSWORD: process.env.ECHOTIK_PASSWORD ?? "e2e-pass",
    },
  },
});
