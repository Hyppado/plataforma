/**
 * lib/avatar-video/index.ts
 *
 * Public API of the avatar-video domain.
 * Import from "@/lib/avatar-video" — never from sub-modules directly.
 */

// Types
export type {
  CreationDTO,
  ImageVariationDTO,
  PromptDTO,
  ProductSelection,
  ServiceResult,
  ServiceOk,
  ServiceErr,
} from "./types";
export { isServiceErr } from "./types";

// VEO 3 prompt types
export type { Veo3Prompt, GenerateVeoPromptResult } from "./veo-prompt";

// Service — orchestration
export {
  getOrCreateDraftCreation,
  updateCreationProduct,
  updateCreationSelections,
  startImageGeneration,
  startPromptGeneration,
  saveEditedPrompt,
  completeCreation,
  getCreationDetail,
  listCreations,
} from "./service";

// Quota — used by cron/admin tooling when needed
export { assertAvatarVideoQuota, consumeAvatarVideoQuota } from "./quota";
