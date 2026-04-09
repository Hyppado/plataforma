/**
 * Tests: lib/email/templates.ts — email template rendering
 */
import { describe, it, expect } from "vitest";
import { buildOnboardingEmail } from "@/lib/email/templates";

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
