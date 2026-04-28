/**
 * lib/avatar-video/types.ts
 *
 * Shared domain types for the avatar video generation flow.
 * All public-facing DTOs live here; Prisma model types are used
 * internally and re-exported where callers need them.
 */

import type {
  AvatarVideoCreationStatus,
  AvatarVideoImageStatus,
  AvatarVideoPromptStatus,
  AvatarVideoConceptStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Avatar profile (public DTO returned by GET /api/avatar-video/avatars)
// ---------------------------------------------------------------------------

export interface AvatarProfileDTO {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Video scenario (public DTO returned by GET /api/avatar-video/scenarios)
// ---------------------------------------------------------------------------

export interface VideoScenarioDTO {
  id: string;
  name: string;
  description: string | null;
  promptHint: string | null;
  isDefault: boolean;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Image variation
// ---------------------------------------------------------------------------

export interface ImageVariationDTO {
  id: string;
  blobUrl: string | null;
  status: AvatarVideoImageStatus;
  sortOrder: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Concept (AI-generated video concept: hook, copy, CTA, scenes)
// ---------------------------------------------------------------------------

export interface ConceptScene {
  sceneNumber: number;
  goal: string;
  description: string;
}

/** Raw OpenAI concept output — persisted to AvatarVideoConcept. */
export interface VideoConcept {
  videoIdea: string;
  hook: string;
  copy: string;
  cta: string;
  scenes: ConceptScene[];
}

export interface ConceptDTO {
  id: string;
  status: AvatarVideoConceptStatus;
  videoIdea: string | null;
  hook: string | null;
  copy: string | null;
  cta: string | null;
  scenes: ConceptScene[] | null;
  isEdited: boolean;
  editedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export interface PromptDTO {
  id: string;
  promptJson: unknown | null;
  promptText: string | null;
  status: AvatarVideoPromptStatus;
  isEdited: boolean;
  editedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Creation (session)
// ---------------------------------------------------------------------------

export interface CreationDTO {
  id: string;
  userId: string;
  avatarProfileId: string | null;
  videoScenarioId: string | null;
  status: AvatarVideoCreationStatus;
  productExternalId: string | null;
  productName: string | null;
  productImageUrl: string | null;
  productSelectedImageUrl: string | null;
  productPriceCents: number | null;
  productCurrency: string | null;
  productCategory: string | null;
  uploadedAvatarImageUrl: string | null;
  customScenarioDescription: string | null;
  tone: string | null;
  duration: string | null;
  takeCount: number | null;
  selectedImageVariationId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  imageVariations: ImageVariationDTO[];
  concept: ConceptDTO | null;
  prompt: PromptDTO | null;
}

// ---------------------------------------------------------------------------
// Service result types (discriminated union pattern)
// ---------------------------------------------------------------------------

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = {
  ok: false;
  error: string;
  code: "quota_exceeded" | "not_found" | "invalid_state" | "internal";
};

export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

export function isServiceErr(r: ServiceResult<unknown>): r is ServiceErr {
  return !r.ok;
}

// ---------------------------------------------------------------------------
// Creation selections input
// ---------------------------------------------------------------------------

/** Fields the user can set while the creation is in DRAFT status. */
export interface CreationSelections {
  /** ID of an AvatarProfile from the library (null = user provided own image) */
  avatarProfileId?: string | null;
  /** Vercel Blob URL of a user-uploaded avatar reference image */
  uploadedAvatarImageUrl?: string | null;
  /** ID of a VideoScenario template (null = custom) */
  videoScenarioId?: string | null;
  /** Free-text description for a custom scenario */
  customScenarioDescription?: string | null;
  /** Delivery tone, e.g. "professional", "casual", "energetic" */
  tone?: string | null;
  /** Desired video duration, e.g. "15s", "30s", "60s" */
  duration?: string | null;
  /** Number of takes to generate (1–5) */
  takeCount?: number | null;
}

// ---------------------------------------------------------------------------
// Product selection input
// ---------------------------------------------------------------------------

export interface ProductSelection {
  productExternalId: string;
  productName: string;
  productImageUrl: string;
  productSelectedImageUrl: string;
  productPriceCents: number | null;
  productCurrency: string | null;
  productCategory: string | null;
}
