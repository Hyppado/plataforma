/**
 * e2e/login.spec.ts — E2E tests for the login flow.
 *
 * Tests the login form UX without relying on a real database or
 * valid credentials. Invalid-credentials tests verify the error
 * message is displayed; happy-path tests require proper setup.
 */
import { test, expect } from "@playwright/test";

test.describe("Login form — structure and labels", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders the email input with correct label", async ({ page }) => {
    const label = page.getByText(/e-?mail/i);
    await expect(label).toBeVisible();
  });

  test("renders the password input with correct label", async ({ page }) => {
    const label = page.getByText(/senha/i);
    await expect(label).toBeVisible();
  });

  test("submit button is enabled by default", async ({ page }) => {
    const submitButton = page.getByRole("button", { name: /entrar/i });
    await expect(submitButton).not.toBeDisabled();
  });

  test("does not show an error message on initial load", async ({ page }) => {
    // Error message container should not be visible before any interaction
    const errorMessages = page.locator('[role="alert"]');
    const visibleErrors = await errorMessages.filter({ hasText: /.+/ }).count();
    expect(visibleErrors).toBe(0);
  });
});

test.describe("Login form — user interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("user can type into the email field", async ({ page }) => {
    const emailInput = page.getByRole("textbox", { name: /email/i });

    await emailInput.fill("test@example.com");

    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("user can type into the password field", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');

    await passwordInput.fill("my-secret-password");

    await expect(passwordInput).toHaveValue("my-secret-password");
  });

  test("submitting with empty fields does not navigate away", async ({
    page,
  }) => {
    const submitButton = page.getByRole("button", { name: /entrar/i });
    const originalURL = page.url();

    await submitButton.click();

    // Give brief time for navigation if it would happen
    await page.waitForTimeout(1000);

    // Should still be on the login page
    expect(page.url()).toContain("/login");
  });

  test("submitting with invalid credentials shows an error", async ({
    page,
  }) => {
    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole("button", { name: /entrar/i });

    await emailInput.fill("invalid@example.com");
    await passwordInput.fill("wrong-password");

    await submitButton.click();

    // Wait for NextAuth to respond: it will return an error which the page shows
    // We allow generous timeout because NextAuth may hit the DB adapter
    await expect(
      page.locator('[role="alert"], .MuiAlert-root, .error-message'),
    ).toBeVisible({ timeout: 10_000 });
  });
});
