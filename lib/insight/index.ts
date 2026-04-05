/**
 * lib/insight/index.ts
 *
 * Public re-exports for the insight module.
 */

export { requestInsight, getInsight } from "./service";
export type { InsightResult, SavedInsight } from "./service";
export {
  generateInsight,
  isGenerateError,
  parseInsightResponse,
} from "./generate";
export type {
  InsightSections,
  GenerateInsightResult,
  GenerateInsightError,
} from "./generate";
