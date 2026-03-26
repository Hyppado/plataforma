/**
 * vitest.component.config.ts — Component tests (React + jsdom)
 *
 * Separate from the backend config so component tests run with a real
 * DOM environment (jsdom) while backend tests stay in `node`.
 *
 * Usage: npm run test:components
 */
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    name: "components",
    environment: "jsdom",
    globals: true,
    setupFiles: ["__tests__/components/setup.tsx"],
    include: ["__tests__/components/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["app/components/**/*.tsx"],
      exclude: ["**/*.d.ts", "**/videoCardConfig.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
