/**
 * lib/email/templates.ts
 * Transactional email templates — server-side only.
 *
 * Templates use inline styles for maximum email client compatibility.
 * No external CSS dependencies.
 */

// ---------------------------------------------------------------------------
// Environment-aware subject prefix
// ---------------------------------------------------------------------------

/**
 * Returns a prefix for email subjects in non-production environments.
 * Production → no prefix. Vercel Preview → "[PREVIEW] ". Local/dev → "[DEV] ".
 */
function envSubjectPrefix(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "";
  if (vercelEnv === "preview") return "[PREVIEW] ";
  return "[DEV] ";
}

// ---------------------------------------------------------------------------
// Shared template wrapper
// ---------------------------------------------------------------------------

function wrapTemplate(body: string): string {
  // Email images must use a publicly accessible URL — never localhost.
  // NEXTAUTH_URL may be localhost in dev, so we use a dedicated constant.
  const emailAssetsBase = process.env.EMAIL_BASE_URL ?? "https://hyppado.com";
  const logoUrl = `${emailAssetsBase}/logo/logo.png`;

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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #12141c; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
          <!-- Logo + tagline -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="56" style="vertical-align: middle; padding-right: 16px;">
                    <img src="${logoUrl}" alt="Hyppado" width="56" height="56" style="display: block; width: 56px; height: 56px; border: 0;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 14px; color: rgba(255,255,255,0.5); letter-spacing: 0.5px;">Inteligência para TikTok Shop</span>
                  </td>
                </tr>
              </table>
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
  const subject = `${envSubjectPrefix()}Seu acesso ao Hyppado está pronto!`;

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
// Boleto / billet printed email
// ---------------------------------------------------------------------------

export interface BilletEmailData {
  /** Buyer name or email prefix */
  name: string;
  /** Plan name */
  planName?: string | null;
  /** URL to pay the boleto (sckPaymentLink) */
  billetUrl?: string | null;
}

/**
 * Generates the HTML for the boleto-printed email sent to the buyer.
 */
export function buildBilletEmail(data: BilletEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${envSubjectPrefix()}Seu boleto Hyppado foi gerado`;

  const ctaBlock = data.billetUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.billetUrl)}"
             target="_blank"
             style="display: inline-block; padding: 14px 36px; background-color: #2DD4FF; color: #0a0a0f; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            Pagar boleto
          </a>
        </td>
      </tr>
    </table>`
    : "";

  const planLine = data.planName
    ? `<p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
        Plano: <strong style="color: #ffffff;">${escapeHtml(data.planName)}</strong>
      </p>`
    : "";

  const html = wrapTemplate(`
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">
      Boleto gerado com sucesso!
    </h1>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Olá, <strong style="color: #ffffff;">${escapeHtml(data.name)}</strong>!
    </p>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Recebemos sua solicitação de assinatura do Hyppado. Seu boleto foi gerado
      e está aguardando pagamento.
    </p>
    ${planLine}
    ${ctaBlock}
    <p style="margin: 0 0 8px; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Após a confirmação do pagamento (pode levar até 3 dias úteis), seu acesso
      será liberado automaticamente e você receberá um novo email de boas-vindas.
    </p>
    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      Se você não reconhece esta compra, ignore este email com segurança.
    </p>
  `);

  const lines = [
    "Boleto gerado com sucesso!",
    "",
    `Olá, ${data.name}!`,
    "",
    "Recebemos sua solicitação de assinatura do Hyppado.",
    "Seu boleto foi gerado e está aguardando pagamento.",
  ];
  if (data.planName) lines.push("", `Plano: ${data.planName}`);
  if (data.billetUrl) lines.push("", "Pagar boleto:", data.billetUrl);
  lines.push(
    "",
    "Após a confirmação do pagamento (pode levar até 3 dias úteis),",
    "seu acesso será liberado automaticamente.",
    "",
    "Se você não reconhece esta compra, ignore este email.",
    "",
    `© ${new Date().getFullYear()} Hyppado — Inteligência para TikTok Shop`,
  );

  return { subject, html, text: lines.join("\n") };
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
  const subject = `${envSubjectPrefix()}Redefinir sua senha — Hyppado`;

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

// ---------------------------------------------------------------------------
// Welcome email with temporary password
// ---------------------------------------------------------------------------

export interface WelcomePasswordEmailData {
  /** User display name or email prefix */
  name: string;
  /** User email address */
  email: string;
  /** The temporary password */
  password: string;
  /** Login URL */
  loginUrl: string;
}

/**
 * Generates the HTML for the welcome email containing a temporary password.
 */
export function buildWelcomePasswordEmail(data: WelcomePasswordEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${envSubjectPrefix()}Seu acesso ao Hyppado — Senha temporária`;

  const html = wrapTemplate(`
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">
      Bem-vindo(a) ao Hyppado!
    </h1>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Olá, <strong style="color: #ffffff;">${escapeHtml(data.name)}</strong>!
    </p>
    <p style="margin: 0 0 12px; font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6;">
      Seu acesso à plataforma Hyppado foi criado. Use as credenciais abaixo para fazer seu primeiro login:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0; background-color: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
      <tr>
        <td style="padding: 20px 24px;">
          <p style="margin: 0 0 10px; font-size: 13px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">
            Email
          </p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #ffffff; font-family: monospace;">
            ${escapeHtml(data.email)}
          </p>
          <p style="margin: 0 0 10px; font-size: 13px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">
            Senha temporária
          </p>
          <p style="margin: 0; font-size: 18px; color: #2DD4FF; font-family: monospace; font-weight: 700; letter-spacing: 1px;">
            ${escapeHtml(data.password)}
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.loginUrl)}"
             target="_blank"
             style="display: inline-block; padding: 14px 36px; background-color: #2DD4FF; color: #0a0a0f; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px;">
            Fazer login
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      <strong style="color: #FFB74D;">Importante:</strong> Após o primeiro login, você será solicitado(a) a trocar sua senha.
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
    "Seu acesso à plataforma Hyppado foi criado.",
    "Use as credenciais abaixo para fazer seu primeiro login:",
    "",
    `Email: ${data.email}`,
    `Senha temporária: ${data.password}`,
    "",
    `Login: ${data.loginUrl}`,
    "",
    "Importante: Após o primeiro login, você será solicitado(a) a trocar sua senha.",
    "",
    "Se você não solicitou este acesso, ignore este email com segurança.",
    "",
    `© ${new Date().getFullYear()} Hyppado — Inteligência para TikTok Shop`,
  ].join("\n");

  return { subject, html, text };
}
