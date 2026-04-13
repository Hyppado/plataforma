/**
 * lib/email/templates.ts
 * Transactional email templates — server-side only.
 *
 * Templates use inline styles for maximum email client compatibility.
 * No external CSS dependencies.
 */

// ---------------------------------------------------------------------------
// Shared template wrapper
// ---------------------------------------------------------------------------

function wrapTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hyppado</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #12141c; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 40px 0;">
              <span style="font-size: 28px; font-weight: 800; color: #2DD4FF; letter-spacing: -0.5px;">Hyppado</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 24px 40px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6;">
                      Precisa de ajuda? Responda este email ou entre em contato pelo suporte.<br />
                      &copy; ${new Date().getFullYear()} Hyppado — Inteligência para TikTok Shop
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Onboarding / first-access email
// ---------------------------------------------------------------------------

export interface OnboardingEmailData {
  /** User display name or email prefix */
  name: string;
  /** Full URL with token for password creation */
  setupUrl: string;
  /** Token expiration in hours */
  expiresInHours: number;
}

/**
 * Generates the HTML for the onboarding/first-access email.
 */
export function buildOnboardingEmail(data: OnboardingEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Seu acesso ao Hyppado está pronto!";

  const html = wrapTemplate(`
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">
      Bem-vindo(a) ao Hyppado!
    </h1>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Olá, <strong style="color: #ffffff;">${escapeHtml(data.name)}</strong>!
    </p>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Seu acesso à plataforma Hyppado foi liberado. Para começar a usar,
      crie sua senha clicando no botão abaixo:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.setupUrl)}"
             target="_blank"
             style="display: inline-block; padding: 14px 36px; background-color: #2DD4FF; color: #0a0a0f; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            Criar minha senha
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Este link é válido por <strong>${data.expiresInHours} horas</strong>.
      Após esse prazo, solicite um novo acesso pelo suporte.
    </p>
    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Se você não solicitou este acesso, ignore este email com segurança.
    </p>
  `);

  const text = [
    "Bem-vindo(a) ao Hyppado!",
    "",
    `Olá, ${data.name}!`,
    "",
    "Seu acesso à plataforma Hyppado foi liberado.",
    "Para começar a usar, crie sua senha acessando o link abaixo:",
    "",
    data.setupUrl,
    "",
    `Este link é válido por ${data.expiresInHours} horas.`,
    "Após esse prazo, solicite um novo acesso pelo suporte.",
    "",
    "Se você não solicitou este acesso, ignore este email com segurança.",
    "",
    `© ${new Date().getFullYear()} Hyppado — Inteligência para TikTok Shop`,
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

export interface PasswordResetEmailData {
  /** User display name or email prefix */
  name: string;
  /** Full URL with token for password reset */
  resetUrl: string;
  /** Token expiration in hours */
  expiresInHours: number;
}

/**
 * Generates the HTML for the password reset email.
 */
export function buildPasswordResetEmail(data: PasswordResetEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Redefinir sua senha — Hyppado";

  const html = wrapTemplate(`
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">
      Redefinição de senha
    </h1>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Olá, <strong style="color: #ffffff;">${escapeHtml(data.name)}</strong>!
    </p>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Recebemos uma solicitação para redefinir a senha da sua conta no Hyppado.
      Clique no botão abaixo para criar uma nova senha:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.resetUrl)}"
             target="_blank"
             style="display: inline-block; padding: 14px 36px; background-color: #2DD4FF; color: #0a0a0f; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            Redefinir minha senha
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Este link é válido por <strong>${data.expiresInHours} hora${data.expiresInHours > 1 ? "s" : ""}</strong>.
      Após esse prazo, solicite um novo link.
    </p>
    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Se você não solicitou esta redefinição, ignore este email.
      Sua senha permanecerá inalterada.
    </p>
  `);

  const text = [
    "Redefinição de senha — Hyppado",
    "",
    `Olá, ${data.name}!`,
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta no Hyppado.",
    "Para criar uma nova senha, acesse o link abaixo:",
    "",
    data.resetUrl,
    "",
    `Este link é válido por ${data.expiresInHours} hora${data.expiresInHours > 1 ? "s" : ""}.`,
    "Após esse prazo, solicite um novo link.",
    "",
    "Se você não solicitou esta redefinição, ignore este email.",
    "Sua senha permanecerá inalterada.",
    "",
    `© ${new Date().getFullYear()} Hyppado — Inteligência para TikTok Shop`,
  ].join("\n");

  return { subject, html, text };
}
