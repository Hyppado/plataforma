/**
 * lib/admin/cost-model.ts
 *
 * Pure cost estimation model for Hyppado's AI features per plan.
 * No DB or server-only imports — safe to use in browser components.
 *
 * All costs are approximations based on public provider pricing.
 * Update UNIT_COSTS_USD when pricing changes.
 */

// ---------------------------------------------------------------------------
// Unit costs (USD) — update as pricing changes
// ---------------------------------------------------------------------------

export const UNIT_COSTS_USD = {
  /** OpenAI Whisper: $0.006/min × 3 min average transcript */
  whisperPerTranscript: 0.018,

  /** GPT-4o-mini input: $0.15 / 1M tokens */
  gpt4oMiniInputPer1kTokens: 0.00015,

  /** GPT-4o-mini output: $0.60 / 1M tokens */
  gpt4oMiniOutputPer1kTokens: 0.0006,

  /** GPT-4o input: $2.50 / 1M tokens */
  gpt4oInputPer1kTokens: 0.0025,

  /** GPT-4o output: $10.00 / 1M tokens */
  gpt4oOutputPer1kTokens: 0.01,

  /**
   * Google Gemini image generation (Flash) — estimated ~$0.02/image.
   * Actual pricing depends on model version and GA availability.
   */
  geminiImagePerImage: 0.02,
} as const;

// ---------------------------------------------------------------------------
// Token assumptions — average per API call
// ---------------------------------------------------------------------------

/** Insight / Script: average input = transcript (~3000 tokens) + system (~500 tokens) */
const AVG_OPENAI_MINI_INPUT_TOKENS = 3500;

/** Avatar Video: Gemini images generated per creation */
const AVATAR_IMAGES_PER_CREATION = 2;

/**
 * Avatar Video VEO prompt (GPT-4o): ~600 input + ~800 output tokens
 * Based on 2-part video defaults (max_tokens = 1024 + 2 × 256 = 1536).
 */
const AVATAR_VEO_INPUT_TOKENS = 600;
const AVATAR_VEO_OUTPUT_TOKENS = 800;

/**
 * Influencer IA VEO prompt (GPT-4o): ~600 input + ~600 output tokens
 * (avg across 2–4 parts)
 */
const INFLUENCER_VEO_INPUT_TOKENS = 600;
const INFLUENCER_VEO_OUTPUT_TOKENS = 600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Plan fields required for cost calculation. Matches Prisma Plan model. */
export interface PlanQuotaFields {
  priceAmount: number;
  periodicity: "MONTHLY" | "ANNUAL";
  transcriptsPerMonth: number;
  scriptsPerMonth: number;
  insightTokensMonthlyMax: number;
  insightMaxOutputTokens: number;
  scriptTokensMonthlyMax: number;
  scriptMaxOutputTokens: number;
  avatarVideoQuota: number;
  influencerIaDailyQuota: number;
}

export interface PlanCostBreakdown {
  /** Gross revenue per subscriber in BRL (priceAmount / 100) */
  revenueBrl: number;
  /** Hotmart fee in BRL (revenueBrl × hotmartFeePercent) */
  hotmartFeeBrl: number;
  /** Revenue after deducting Hotmart fee */
  netRevenueBrl: number;

  // --- Transcripts (Whisper) ---
  transcriptCostUsd: number;

  // --- Insights (GPT-4o-mini) ---
  insightCostUsd: number;
  /** Derived: how many insight calls fit in insightTokensMonthlyMax */
  insightCallsPerMonth: number;

  // --- Scripts (GPT-4o-mini) ---
  scriptCostUsd: number;
  /** Derived: how many script calls fit in scriptTokensMonthlyMax */
  scriptCallsPerMonth: number;

  // --- Avatar Video ---
  /** Gemini image generation cost (2 images per creation) */
  avatarImagesCostUsd: number;
  /** GPT-4o VEO prompt cost per creation */
  avatarVeoCostUsd: number;

  // --- Influencer IA ---
  /**
   * Gemini image generation cost.
   * Monthly ceiling = influencerIaDailyQuota × 30 uses.
   */
  influencerImagesCostUsd: number;
  /** GPT-4o VEO prompt cost per monthly generation ceiling */
  influencerVeoCostUsd: number;
  /** Derived: influencerIaDailyQuota × 30 */
  influencerMonthlyGenMax: number;

  // --- Totals ---
  /** Number of months in the billing period (1 = monthly, 12 = annual). */
  billingMonths: number;
  /** Monthly revenue equivalent (revenueBrl / billingMonths). */
  monthlyRevenueBrl: number;
  /** Monthly AI cost in USD (per-month basis, before billing period scaling). */
  monthlyAiCostUsd: number;
  /** Monthly AI cost in BRL. */
  monthlyAiCostBrl: number;
  /** Total AI cost in USD for the full billing period (monthly × billingMonths). */
  totalAiCostUsd: number;
  /** Total AI cost in BRL for the full billing period. */
  totalAiCostBrl: number;
  /** hotmartFeeBrl + totalAiCostBrl (full period) */
  totalMaxCostBrl: number;
  /** netRevenueBrl - totalAiCostBrl (both full period). */
  marginBrl: number;
  /** Monthly margin equivalent (marginBrl / billingMonths). */
  monthlyMarginBrl: number;
  /** (marginBrl / revenueBrl) × 100, or 0 if revenueBrl is 0 */
  marginPercent: number;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Calculates the estimated monthly AI cost for a plan.
 *
 * @param plan - Plan quota fields from the DB.
 * @param usdToBrl - Current USD → BRL exchange rate.
 * @param utilizationRate - Fraction of quota actually consumed (0–1, default 1.0).
 * @param hotmartFeePercent - Hotmart transaction fee as a decimal (default 0.099 = 9.9%).
 */
export function calcPlanCost(
  plan: PlanQuotaFields,
  usdToBrl: number,
  utilizationRate: number = 1,
  hotmartFeePercent: number = 0.099,
): PlanCostBreakdown {
  const {
    priceAmount,
    transcriptsPerMonth,
    insightTokensMonthlyMax,
    insightMaxOutputTokens,
    scriptTokensMonthlyMax,
    scriptMaxOutputTokens,
    avatarVideoQuota,
    influencerIaDailyQuota,
  } = plan;

  const u = Math.max(0, Math.min(1, utilizationRate));

  const revenueBrl = priceAmount / 100;

  // ---- Transcripts --------------------------------------------------------
  const transcriptCostUsd =
    transcriptsPerMonth * u * UNIT_COSTS_USD.whisperPerTranscript;

  // ---- Insights -----------------------------------------------------------
  const insightCallsPerMonth =
    insightMaxOutputTokens > 0
      ? Math.ceil(insightTokensMonthlyMax / insightMaxOutputTokens)
      : 0;

  const insightCostUsd =
    insightCallsPerMonth *
    u *
    ((AVG_OPENAI_MINI_INPUT_TOKENS / 1000) *
      UNIT_COSTS_USD.gpt4oMiniInputPer1kTokens +
      (insightMaxOutputTokens / 1000) *
        UNIT_COSTS_USD.gpt4oMiniOutputPer1kTokens);

  // ---- Scripts ------------------------------------------------------------
  const scriptCallsPerMonth =
    scriptMaxOutputTokens > 0
      ? Math.ceil(scriptTokensMonthlyMax / scriptMaxOutputTokens)
      : 0;

  const scriptCostUsd =
    scriptCallsPerMonth *
    u *
    ((AVG_OPENAI_MINI_INPUT_TOKENS / 1000) *
      UNIT_COSTS_USD.gpt4oMiniInputPer1kTokens +
      (scriptMaxOutputTokens / 1000) *
        UNIT_COSTS_USD.gpt4oMiniOutputPer1kTokens);

  // ---- Avatar Video -------------------------------------------------------
  const avatarImagesCostUsd =
    avatarVideoQuota *
    u *
    AVATAR_IMAGES_PER_CREATION *
    UNIT_COSTS_USD.geminiImagePerImage;

  const avatarVeoCostUsd =
    avatarVideoQuota *
    u *
    ((AVATAR_VEO_INPUT_TOKENS / 1000) * UNIT_COSTS_USD.gpt4oInputPer1kTokens +
      (AVATAR_VEO_OUTPUT_TOKENS / 1000) *
        UNIT_COSTS_USD.gpt4oOutputPer1kTokens);

  // ---- Influencer IA ------------------------------------------------------
  // Monthly cap = avatarVideoQuota (reused for Influencer IA).
  // influencerIaDailyQuota is only the daily pace limiter — the user is blocked
  // for the rest of the month once they exhaust avatarVideoQuota total.
  const influencerMonthlyGenMax = avatarVideoQuota;

  const influencerImagesCostUsd =
    influencerMonthlyGenMax * u * UNIT_COSTS_USD.geminiImagePerImage;

  const influencerVeoCostUsd =
    influencerMonthlyGenMax *
    u *
    ((INFLUENCER_VEO_INPUT_TOKENS / 1000) *
      UNIT_COSTS_USD.gpt4oInputPer1kTokens +
      (INFLUENCER_VEO_OUTPUT_TOKENS / 1000) *
        UNIT_COSTS_USD.gpt4oOutputPer1kTokens);

  // ---- Totals -------------------------------------------------------------
  const billingMonths = plan.periodicity === "ANNUAL" ? 12 : 1;

  const monthlyAiCostUsd =
    transcriptCostUsd +
    insightCostUsd +
    scriptCostUsd +
    avatarImagesCostUsd +
    avatarVeoCostUsd +
    influencerImagesCostUsd +
    influencerVeoCostUsd;

  // Scale to billing period so revenue and AI costs are always comparable.
  const totalAiCostUsd = monthlyAiCostUsd * billingMonths;
  const monthlyAiCostBrl = monthlyAiCostUsd * usdToBrl;
  const totalAiCostBrl = totalAiCostUsd * usdToBrl;

  const hotmartFeeBrl =
    revenueBrl * Math.max(0, Math.min(1, hotmartFeePercent));
  const netRevenueBrl = revenueBrl - hotmartFeeBrl;
  const monthlyRevenueBrl = revenueBrl / billingMonths;
  const totalMaxCostBrl = hotmartFeeBrl + totalAiCostBrl;
  const marginBrl = netRevenueBrl - totalAiCostBrl;
  const monthlyMarginBrl = marginBrl / billingMonths;
  const marginPercent = revenueBrl > 0 ? (marginBrl / revenueBrl) * 100 : 0;

  return {
    revenueBrl,
    hotmartFeeBrl,
    netRevenueBrl,
    billingMonths,
    monthlyRevenueBrl,
    monthlyAiCostUsd,
    monthlyAiCostBrl,
    transcriptCostUsd,
    insightCostUsd,
    insightCallsPerMonth,
    scriptCostUsd,
    scriptCallsPerMonth,
    avatarImagesCostUsd,
    avatarVeoCostUsd,
    influencerImagesCostUsd,
    influencerVeoCostUsd,
    influencerMonthlyGenMax,
    totalAiCostUsd,
    totalAiCostBrl,
    totalMaxCostBrl,
    marginBrl,
    monthlyMarginBrl,
    marginPercent,
  };
}
