/**
 * lib/email/client.ts
 * Resend email client — server-side only.
 *
 * Provides a reusable, type-safe email sending service.
 * RESEND_API_KEY must be configured in the environment.
 * Sender domain: hyppado.com (verified in Resend dashboard).
 */

import { Resend } from "resend";
import { createLogger } from "../logger";

const log = createLogger("email/client");

// ---------------------------------------------------------------------------
// Singleton Resend client (lazy init)
// ---------------------------------------------------------------------------

let _resend: Resend | null = null;

function getClient(): Resend | null {
  if (_resend) return _resend;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn("RESEND_API_KEY not configured — email delivery disabled");
    return null;
  }

  _resend = new Resend(apiKey);
  return _resend;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Visible sender — must match a verified domain in Resend */
export const EMAIL_FROM = "Hyppado <suporte@hyppado.com>";

/** Reply-to address — routes replies to the support mailbox */
export const EMAIL_REPLY_TO = "suportehyppado@gmail.com";

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

/**
 * Returns the base URL for email links, respecting the current environment.
 *
 * - Vercel Production  → https://hyppado.com
 * - Vercel Preview/Dev → https://dev.hyppado.com
 * - Local (no VERCEL)  → NEXTAUTH_URL or http://localhost:3000
 */
export function getEmailBaseUrl(): string {
  // On Vercel, use the deterministic domain based on environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://hyppado.com";
  }
  if (process.env.VERCEL_ENV) {
    // preview or development
    return "https://dev.hyppado.com";
  }
  // Local development — fall back to NEXTAUTH_URL or localhost
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional text fallback for email clients that don't render HTML */
  text?: string;
  /** Override reply-to (defaults to EMAIL_REPLY_TO) */
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * Send a transactional email via Resend.
 *
 * Returns a result object instead of throwing.
 * Logs structured events for observability.
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    log.warn("Email not sent — Resend client not available", {
      to: options.to,
      subject: options.subject,
    });
    return { success: false, error: "Email delivery not configured" };
  }

  try {
    const result = await client.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo ?? EMAIL_REPLY_TO,
    });

    if (result.error) {
      log.error("Resend API error", {
        to: options.to,
        subject: options.subject,
        error: result.error.message,
      });
      return { success: false, error: result.error.message };
    }

    log.info("Email sent successfully", {
      to: options.to,
      subject: options.subject,
      messageId: result.data?.id,
    });

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to send email", {
      to: options.to,
      subject: options.subject,
      error: message,
    });
    return { success: false, error: message };
  }
}
