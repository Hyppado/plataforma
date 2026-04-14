/**
 * Tests: lib/email/templates.ts — email template rendering
 */
import { describe, it, expect } from "vitest";
import {
  buildOnboardingEmail,
  buildPasswordResetEmail,
  buildWelcomePasswordEmail,
} from "@/lib/email/templates";

describe("buildOnboardingEmail()", () => {
  const data = {
    name: "Maria Silva",
    setupUrl: "https://hyppado.com/criar-senha?token=abc123",
    expiresInHours: 24,
  };

  it("returns subject, html, and text", () => {
    const result = buildOnboardingEmail(data);
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it("includes the user name in the HTML", () => {
    const { html } = buildOnboardingEmail(data);
    expect(html).toContain("Maria Silva");
  });

  it("includes the setup URL in both HTML and text", () => {
    const { html, text } = buildOnboardingEmail(data);
    expect(html).toContain(data.setupUrl);
    expect(text).toContain(data.setupUrl);
  });

  it('includes the CTA button text "Criar minha senha"', () => {
    const { html } = buildOnboardingEmail(data);
    expect(html).toContain("Criar minha senha");
  });

  it("includes the expiry hours in the body", () => {
    const { html, text } = buildOnboardingEmail(data);
    expect(html).toContain("24 horas");
    expect(text).toContain("24 horas");
  });

  it("includes Hyppado branding", () => {
    const { html, text } = buildOnboardingEmail(data);
    expect(html).toContain("Hyppado");
    expect(text).toContain("Hyppado");
  });

  it("subject is in Portuguese", () => {
    const { subject } = buildOnboardingEmail(data);
    expect(subject).toContain("Hyppado");
    expect(subject.length).toBeGreaterThan(10);
  });

  it("escapes HTML in user name to prevent XSS", () => {
    const malicious = buildOnboardingEmail({
      ...data,
      name: '<script>alert("xss")</script>',
    });
    expect(malicious.html).not.toContain("<script>");
    expect(malicious.html).toContain("&lt;script&gt;");
  });

  it("text fallback is readable without HTML", () => {
    const { text } = buildOnboardingEmail(data);
    expect(text).not.toContain("<");
    expect(text).toContain("Maria Silva");
    expect(text).toContain(data.setupUrl);
  });
});

// ---------------------------------------------------------------------------
// Password Reset Template
// ---------------------------------------------------------------------------

describe("buildPasswordResetEmail()", () => {
  const data = {
    name: "João Pereira",
    resetUrl: "https://hyppado.com/criar-senha?token=reset123",
    expiresInHours: 1,
  };

  it("returns subject, html, and text", () => {
    const result = buildPasswordResetEmail(data);
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it("includes the user name in the HTML", () => {
    const { html } = buildPasswordResetEmail(data);
    expect(html).toContain("João Pereira");
  });

  it("includes the reset URL in both HTML and text", () => {
    const { html, text } = buildPasswordResetEmail(data);
    expect(html).toContain(data.resetUrl);
    expect(text).toContain(data.resetUrl);
  });

  it('includes the CTA button text "Redefinir minha senha"', () => {
    const { html } = buildPasswordResetEmail(data);
    expect(html).toContain("Redefinir minha senha");
  });

  it("includes the expiry hours with correct singular form", () => {
    const { html, text } = buildPasswordResetEmail(data);
    expect(html).toContain("1 hora");
    expect(text).toContain("1 hora");
    // Should not say "horas" for 1
    expect(html).not.toContain("1 horas");
  });

  it("uses plural for multiple hours", () => {
    const { html, text } = buildPasswordResetEmail({
      ...data,
      expiresInHours: 2,
    });
    expect(html).toContain("2 horas");
    expect(text).toContain("2 horas");
  });

  it("subject mentions password reset", () => {
    const { subject } = buildPasswordResetEmail(data);
    expect(subject).toContain("Redefinir");
    expect(subject).toContain("Hyppado");
  });

  it("includes safety message about ignoring email", () => {
    const { html, text } = buildPasswordResetEmail(data);
    expect(html).toContain("não solicitou esta redefinição");
    expect(text).toContain("não solicitou esta redefinição");
  });

  it("escapes HTML in user name to prevent XSS", () => {
    const malicious = buildPasswordResetEmail({
      ...data,
      name: '<script>alert("xss")</script>',
    });
    expect(malicious.html).not.toContain("<script>");
    expect(malicious.html).toContain("&lt;script&gt;");
  });

  it("text fallback is readable without HTML", () => {
    const { text } = buildPasswordResetEmail(data);
    expect(text).not.toContain("<");
    expect(text).toContain("João Pereira");
    expect(text).toContain(data.resetUrl);
  });
});

describe("buildWelcomePasswordEmail()", () => {
  const data = {
    name: "Ana Costa",
    email: "ana@test.com",
    password: "TempPass123!",
    loginUrl: "https://hyppado.com/login",
  };

  it("returns subject, html, and text", () => {
    const result = buildWelcomePasswordEmail(data);
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it("includes the user name in the HTML", () => {
    const { html } = buildWelcomePasswordEmail(data);
    expect(html).toContain("Ana Costa");
  });

  it("includes the email in both HTML and text", () => {
    const { html, text } = buildWelcomePasswordEmail(data);
    expect(html).toContain("ana@test.com");
    expect(text).toContain("ana@test.com");
  });

  it("includes the temporary password in both HTML and text", () => {
    const { html, text } = buildWelcomePasswordEmail(data);
    expect(html).toContain("TempPass123!");
    expect(text).toContain("TempPass123!");
  });

  it("includes the login URL", () => {
    const { html, text } = buildWelcomePasswordEmail(data);
    expect(html).toContain(data.loginUrl);
    expect(text).toContain(data.loginUrl);
  });

  it("warns about forced password change", () => {
    const { html, text } = buildWelcomePasswordEmail(data);
    expect(html).toContain("trocar sua senha");
    expect(text).toContain("trocar sua senha");
  });

  it("escapes HTML in user name to prevent XSS", () => {
    const malicious = buildWelcomePasswordEmail({
      ...data,
      name: '<script>alert("xss")</script>',
    });
    expect(malicious.html).not.toContain("<script>");
    expect(malicious.html).toContain("&lt;script&gt;");
  });

  it("text fallback is readable without HTML", () => {
    const { text } = buildWelcomePasswordEmail(data);
    expect(text).not.toContain("<");
    expect(text).toContain("Ana Costa");
    expect(text).toContain("TempPass123!");
  });
});
