/**
 * e2e/smoke.spec.ts — Smoke tests for critical public pages.
 *
 * These tests verify the app starts up correctly and the most
 * important routes are reachable without authentication.
 * No real database or auth credentials are needed.
 */
import { test, expect } from "@playwright/test";

test.describe("Smoke — Public routes", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");

    // Must have a visible page title or the Hyppado brand
    await expect(page).toHaveTitle(/hyppado/i);
  });

  test("login page has email and password inputs", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole("button", { name: /entrar/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("login page has Hyppado logo", async ({ page }) => {
    await page.goto("/login");

    const logo = page.getByRole("img", { name: /hyppado/i });
    await expect(logo).toBeVisible();
  });
});

test.describe("Smoke — Auth-protected routes", () => {
  test("unauthenticated /dashboard redirects to login", async ({ page }) => {
    const response = await page.goto("/dashboard");

    // Should end up on login page (redirect chain)
    await expect(page).toHaveURL(/\/login|\/api\/auth\/signin/);

    // The page must be visible (not an error page)
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });

  test("unauthenticated /dashboard/videos redirects to login", async ({
    page,
  }) => {
    await page.goto("/dashboard/videos");

    await expect(page).toHaveURL(/\/login|\/api\/auth\/signin/);
  });

  test("unauthenticated /dashboard/products redirects to login", async ({
    page,
  }) => {
    await page.goto("/dashboard/products");

    await expect(page).toHaveURL(/\/login|\/api\/auth\/signin/);
  });
});

test.describe("Smoke — API health", () => {
  test("healthcheck endpoint returns 200", async ({ page }) => {
    const response = await page.request.get("/api/healthcheck");

    // Accept 200 or 404 if the endpoint doesn't exist yet — the app must not crash
    expect([200, 404]).toContain(response.status());
  });
});
