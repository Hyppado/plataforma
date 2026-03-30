/**
 * Vitest global test setup
 *
 * - Sets safe default env vars (never real credentials)
 * - Mocks Prisma globally via singleton pattern
 * - Mocks NextAuth getServerSession
 * - Provides cleanup hooks
 */
import { vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Safe environment defaults — prevent accidental real API calls
// ---------------------------------------------------------------------------
vi.stubEnv("NODE_ENV", "test");
process.env.NEXTAUTH_SECRET = "test-secret-32-chars-minimum-ok";
process.env.CRON_SECRET = "test-cron-secret";
process.env.HOTMART_CLIENTE_ID = "test-client-id";
process.env.HOTMART_CLIENT_SECRET = "test-client-secret";
process.env.HOTMART_BASIC = "dGVzdC1jbGllbnQtaWQ6dGVzdC1jbGllbnQtc2VjcmV0"; // base64
process.env.HOTMART_WEBHOOK_SECRET = "test-hottok-secret";
process.env.HOTMART_PRODUCT_ID = "7420891";
process.env.ECHOTIK_BASE_URL = "https://test.echotik.local";
process.env.ECHOTIK_USERNAME = "test-echotik-user";
process.env.ECHOTIK_PASSWORD = "test-echotik-pass";
// Regions come from the database (Region table), not from env vars.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
