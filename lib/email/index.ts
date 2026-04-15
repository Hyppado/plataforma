/**
 * lib/email/index.ts
 * Public re-exports for the email module.
 */

export {
  sendEmail,
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  getEmailBaseUrl,
} from "./client";
export type { SendEmailOptions, SendEmailResult } from "./client";

export { sendOnboardingEmail } from "./onboarding";
export type {
  SendOnboardingEmailOptions,
  SendOnboardingEmailResult,
} from "./onboarding";

export { sendPasswordResetEmail } from "./password-reset";
export type {
  SendPasswordResetOptions,
  SendPasswordResetResult,
} from "./password-reset";

export {
  generateSetupToken,
  validateSetupToken,
  consumeSetupToken,
  hashToken,
  ONBOARDING_TOKEN_EXPIRY_HOURS,
  RESET_TOKEN_EXPIRY_HOURS,
} from "./setup-token";
export type { TokenValidationResult } from "./setup-token";

export {
  buildOnboardingEmail,
  buildPasswordResetEmail,
  buildWelcomePasswordEmail,
} from "./templates";
export type {
  OnboardingEmailData,
  PasswordResetEmailData,
  WelcomePasswordEmailData,
} from "./templates";
