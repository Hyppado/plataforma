import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@tests": path.resolve(__dirname, "__tests__"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    // Separate test pools for isolation
    include: ["__tests__/**/*.test.ts"],
    // Coverage config
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts", "middleware.ts"],
      exclude: [
        "lib/types/**",
        "lib/hooks/**",
        "lib/admin/admin-client.ts",
        "lib/admin/useQuotaUsage.ts",
        "**/*.d.ts",
      ],
      reporter: ["text", "text-summary", "lcov"],
      thresholds: {
        // Critical modules should have high coverage
        "lib/auth.ts": { statements: 90 },
        "lib/access/resolver.ts": { statements: 90 },
        "lib/usage/**": { statements: 80 },
        "lib/hotmart/webhook.ts": { statements: 85 },
        "lib/hotmart/processor.ts": { statements: 80 },
      },
    },
  },
});
