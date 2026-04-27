/**
 * lib/avatar-video/service.ts
 *
 * Orchestration layer for the avatar video generation flow.
 *
 * State machine:
 *   DRAFT  →  (product + avatar + scenario set)
 *          →  PENDING_IMAGES  →  IMAGES_READY
 *          →  PENDING_PROMPT  →  PROMPT_READY
 *          →  COMPLETED
 *          →  FAILED (unrecoverable error at any step)
 *
 * Every exported function:
 *  - validates user ownership of the creation
 *  - validates the current status allows the requested transition
 *  - enforces quota before calling expensive external services
 *  - returns a discriminated ServiceResult (never throws to callers)
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { AvatarVideoCreation } from "@prisma/client";
import type {
  CreationDTO,
  ProductSelection,
  CreationSelections,
  ServiceResult,
} from "./types";
import {
  assertAvatarVideoQuota,
  consumeAvatarVideoQuota,
  quotaExceededToServiceErr,
} from "./quota";
import { QuotaExceededError } from "@/lib/usage";
import { buildImagePromptText, generateImageVariation } from "./image-prompt";
import { generateAndPersistVeoPrompt } from "./veo-prompt";

const log = createLogger("avatar-video/service");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Selects all columns and relations needed to build CreationDTO. */
const creationInclude = {
  imageVariations: true,
  prompt: true,
} as const;

type CreationWithRelations = AvatarVideoCreation & {
  imageVariations: {
    id: string;
    blobUrl: string | null;
    status: string;
    sortOrder: number;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  prompt: {
    id: string;
    promptJson: unknown;
    promptText: string | null;
    status: string;
    isEdited: boolean;
    editedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function toCreationDTO(c: CreationWithRelations): CreationDTO {
  return {
    id: c.id,
    userId: c.userId,
    avatarProfileId: c.avatarProfileId,
    videoScenarioId: c.videoScenarioId,
    status: c.status,
    productExternalId: c.productExternalId,
    productName: c.productName,
    productImageUrl: c.productImageUrl,
    productSelectedImageUrl: c.productSelectedImageUrl,
    productPriceCents: c.productPriceCents,
    productCurrency: c.productCurrency,
    productCategory: c.productCategory,
    uploadedAvatarImageUrl: c.uploadedAvatarImageUrl,
    customScenarioDescription: c.customScenarioDescription,
    tone: c.tone,
    duration: c.duration,
    takeCount: c.takeCount,
    selectedImageVariationId: c.selectedImageVariationId,
    errorMessage: c.errorMessage,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    imageVariations: c.imageVariations as CreationDTO["imageVariations"],
    prompt: c.prompt as CreationDTO["prompt"],
  };
}

/** Loads a creation and verifies it belongs to `userId`. */
async function loadOwnedCreation(
  creationId: string,
  userId: string,
): Promise<ServiceResult<CreationWithRelations>> {
  const creation = await prisma.avatarVideoCreation.findUnique({
    where: { id: creationId },
    include: creationInclude,
  });

  if (!creation) {
    return { ok: false, error: "Criação não encontrada.", code: "not_found" };
  }
  if (creation.userId !== userId) {
    // Treat as not-found to avoid leaking existence
    return { ok: false, error: "Criação não encontrada.", code: "not_found" };
  }

  return { ok: true, data: creation };
}

/** Marks a creation as FAILED with an error message. */
async function failCreation(
  creationId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.avatarVideoCreation.update({
    where: { id: creationId },
    data: { status: "FAILED", errorMessage },
  });
}

// ---------------------------------------------------------------------------
// Create or resume a DRAFT creation
// ---------------------------------------------------------------------------

/**
 * Returns the user's active DRAFT creation, or creates one if none exists.
 * There can only be one active DRAFT per user at a time.
 * A previous FAILED creation is not reused — a fresh DRAFT is created.
 */
export async function getOrCreateDraftCreation(
  userId: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    // Find the most recent DRAFT (one per user by convention)
    const existing = await prisma.avatarVideoCreation.findFirst({
      where: { userId, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      include: creationInclude,
    });

    if (existing) {
      log.info("Returning existing draft creation", {
        userId,
        creationId: existing.id,
      });
      return { ok: true, data: toCreationDTO(existing) };
    }

    const created = await prisma.avatarVideoCreation.create({
      data: { userId, status: "DRAFT" },
      include: creationInclude,
    });

    log.info("New draft creation created", { userId, creationId: created.id });
    return { ok: true, data: toCreationDTO(created) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to get or create draft creation", {
      userId,
      error: message,
    });
    return {
      ok: false,
      error: "Erro ao iniciar sessão de criação.",
      code: "internal",
    };
  }
}

// ---------------------------------------------------------------------------
// Update product selection
// ---------------------------------------------------------------------------

/**
 * Saves the product snapshot on a DRAFT creation.
 * Only allowed while status is DRAFT.
 */
export async function updateCreationProduct(
  userId: string,
  creationId: string,
  product: ProductSelection,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    if (creation.status !== "DRAFT") {
      return {
        ok: false,
        error: `Não é possível atualizar o produto com status "${creation.status}".`,
        code: "invalid_state",
      };
    }

    const updated = await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: {
        productExternalId: product.productExternalId,
        productName: product.productName,
        productImageUrl: product.productImageUrl,
        productSelectedImageUrl: product.productSelectedImageUrl,
        productPriceCents: product.productPriceCents,
        productCurrency: product.productCurrency,
        productCategory: product.productCategory,
      },
      include: creationInclude,
    });

    log.info("Creation product updated", { userId, creationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to update creation product", {
      userId,
      creationId,
      error: message,
    });
    return { ok: false, error: "Erro ao salvar produto.", code: "internal" };
  }
}

// ---------------------------------------------------------------------------
// Update avatar and scenario selections
// ---------------------------------------------------------------------------

/**
 * Saves avatar profile and/or scenario selection on a DRAFT creation.
 * Any omitted field is left unchanged; passing null explicitly clears the value.
 */
export async function updateCreationSelections(
  userId: string,
  creationId: string,
  selections: CreationSelections,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    if (creation.status !== "DRAFT") {
      return {
        ok: false,
        error: `Não é possível alterar seleções com status "${creation.status}".`,
        code: "invalid_state",
      };
    }

    // Validate takeCount when provided
    if (
      selections.takeCount !== undefined &&
      selections.takeCount !== null &&
      (selections.takeCount < 1 ||
        selections.takeCount > 5 ||
        !Number.isInteger(selections.takeCount))
    ) {
      return {
        ok: false,
        error: "takeCount deve ser um número inteiro entre 1 e 5.",
        code: "invalid_state",
      };
    }

    const updated = await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: {
        ...(selections.avatarProfileId !== undefined && {
          avatarProfile: selections.avatarProfileId
            ? { connect: { id: selections.avatarProfileId } }
            : { disconnect: true },
        }),
        ...(selections.uploadedAvatarImageUrl !== undefined && {
          uploadedAvatarImageUrl: selections.uploadedAvatarImageUrl,
        }),
        ...(selections.videoScenarioId !== undefined && {
          videoScenario: selections.videoScenarioId
            ? { connect: { id: selections.videoScenarioId } }
            : { disconnect: true },
        }),
        ...(selections.customScenarioDescription !== undefined && {
          customScenarioDescription: selections.customScenarioDescription,
        }),
        ...(selections.tone !== undefined && {
          tone: selections.tone,
        }),
        ...(selections.duration !== undefined && {
          duration: selections.duration,
        }),
        ...(selections.takeCount !== undefined && {
          takeCount: selections.takeCount,
        }),
      },
      include: creationInclude,
    });

    log.info("Creation selections updated", { userId, creationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to update creation selections", {
      userId,
      creationId,
      error: message,
    });
    return { ok: false, error: "Erro ao salvar seleções.", code: "internal" };
  }
}

// ---------------------------------------------------------------------------
// Start image generation
// ---------------------------------------------------------------------------

/**
 * Transitions the creation from DRAFT → PENDING_IMAGES and fires image generation.
 *
 * Prerequisites:
 *   - status must be DRAFT
 *   - productExternalId must be set (product was selected)
 *   - quota must be available
 *
 * Generates 2 image variations (sortOrder 0 and 1) in sequence.
 * On completion, transitions to IMAGES_READY.
 * On failure, transitions to FAILED and returns ServiceErr.
 */
export async function startImageGeneration(
  userId: string,
  creationId: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    const allowedStatuses = ["DRAFT", "IMAGES_READY", "FAILED"] as const;
    if (!(allowedStatuses as readonly string[]).includes(creation.status)) {
      return {
        ok: false,
        error: `Geração de imagens requer status DRAFT, IMAGES_READY ou FAILED (atual: "${creation.status}").`,
        code: "invalid_state",
      };
    }

    if (!creation.productExternalId) {
      return {
        ok: false,
        error: "Selecione um produto antes de gerar as imagens.",
        code: "invalid_state",
      };
    }

    // Enforce quota before calling external services
    try {
      await assertAvatarVideoQuota(userId);
    } catch (err) {
      if (err instanceof QuotaExceededError)
        return quotaExceededToServiceErr(err);
      throw err;
    }

    // For regeneration (IMAGES_READY or FAILED), remove existing variations first
    // and clear any previously selected variation (IDs become stale after deletion)
    if (creation.status !== "DRAFT") {
      await prisma.avatarVideoImageVariation.deleteMany({
        where: { creationId },
      });
      await prisma.avatarVideoCreation.update({
        where: { id: creationId },
        data: { selectedImageVariationId: null },
      });
    }

    // Load related entities for prompt building
    const [avatar, scenario] = await Promise.all([
      creation.avatarProfileId
        ? prisma.avatarProfile.findUnique({
            where: { id: creation.avatarProfileId },
          })
        : Promise.resolve(null),
      creation.videoScenarioId
        ? prisma.videoScenario.findUnique({
            where: { id: creation.videoScenarioId },
          })
        : Promise.resolve(null),
    ]);

    // Transition to PENDING_IMAGES (clear any previous error message)
    await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: { status: "PENDING_IMAGES", errorMessage: null },
    });

    const promptText = buildImagePromptText(creation, avatar, scenario);

    // Generate both image slots
    const results = await Promise.all([
      generateImageVariation(creationId, 0, promptText),
      generateImageVariation(creationId, 1, promptText),
    ]);

    const allOk = results.every((r) => r.ok);

    if (allOk) {
      // Consume quota and transition to IMAGES_READY
      await consumeAvatarVideoQuota(userId, creationId);

      const updated = await prisma.avatarVideoCreation.update({
        where: { id: creationId },
        data: { status: "IMAGES_READY" },
        include: creationInclude,
      });

      log.info("Image generation completed", { userId, creationId });
      return { ok: true, data: toCreationDTO(updated) };
    } else {
      const firstError = results.find((r) => !r.ok);
      const errorMsg =
        firstError && !firstError.ok
          ? firstError.error
          : "Erro desconhecido na geração de imagens.";
      await failCreation(creationId, errorMsg);
      return { ok: false, error: errorMsg, code: "internal" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Unexpected error in startImageGeneration", {
      userId,
      creationId,
      error: message,
    });
    await failCreation(creationId, message).catch(() => {});
    return {
      ok: false,
      error: "Erro interno na geração de imagens.",
      code: "internal",
    };
  }
}

// ---------------------------------------------------------------------------
// Select preferred image variation
// ---------------------------------------------------------------------------

/**
 * Records which image variation the user prefers.
 * Only allowed when status is IMAGES_READY.
 * Passing null clears any existing selection.
 */
export async function selectImageVariation(
  userId: string,
  creationId: string,
  variationId: string | null,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    if (creation.status !== "IMAGES_READY") {
      return {
        ok: false,
        error: `Seleção de imagem requer status IMAGES_READY (atual: "${creation.status}").`,
        code: "invalid_state",
      };
    }

    // Validate that variationId belongs to this creation when provided
    if (variationId !== null) {
      const belongs = creation.imageVariations.some(
        (v) => v.id === variationId,
      );
      if (!belongs) {
        return {
          ok: false,
          error: "Variação de imagem não encontrada.",
          code: "not_found",
        };
      }
    }

    const updated = await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: { selectedImageVariationId: variationId },
      include: creationInclude,
    });

    log.info("Image variation selected", { userId, creationId, variationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to select image variation", {
      userId,
      creationId,
      error: message,
    });
    return {
      ok: false,
      error: "Erro ao salvar seleção de imagem.",
      code: "internal",
    };
  }
}

// ---------------------------------------------------------------------------
// Start prompt generation
// ---------------------------------------------------------------------------

/**
 * Transitions the creation from IMAGES_READY → PENDING_PROMPT and fires VEO 3 prompt generation.
 *
 * Prerequisites:
 *   - status must be IMAGES_READY or PROMPT_READY (allows regeneration)
 *   - at least one image variation must be READY
 *
 * On completion, transitions to PROMPT_READY.
 * On failure, transitions to FAILED and returns ServiceErr.
 */
export async function startPromptGeneration(
  userId: string,
  creationId: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    const allowedStatuses: AvatarVideoCreation["status"][] = [
      "IMAGES_READY",
      "PROMPT_READY",
    ];
    if (!allowedStatuses.includes(creation.status)) {
      return {
        ok: false,
        error: `Geração de prompt requer status IMAGES_READY ou PROMPT_READY (atual: "${creation.status}").`,
        code: "invalid_state",
      };
    }

    // Load related entities
    const [avatar, scenario] = await Promise.all([
      creation.avatarProfileId
        ? prisma.avatarProfile.findUnique({
            where: { id: creation.avatarProfileId },
          })
        : Promise.resolve(null),
      creation.videoScenarioId
        ? prisma.videoScenario.findUnique({
            where: { id: creation.videoScenarioId },
          })
        : Promise.resolve(null),
    ]);

    const readyVariations = creation.imageVariations.filter(
      (v) => v.status === "READY",
    ) as Parameters<typeof generateAndPersistVeoPrompt>[3];

    if (readyVariations.length === 0) {
      return {
        ok: false,
        error: "Nenhuma imagem pronta. Gere as imagens primeiro.",
        code: "invalid_state",
      };
    }

    // Transition to PENDING_PROMPT
    await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: { status: "PENDING_PROMPT" },
    });

    const result = await generateAndPersistVeoPrompt(
      creation,
      avatar,
      scenario,
      readyVariations,
    );

    if (!result.ok) {
      await failCreation(creationId, result.error);
      return result;
    }

    const updated = await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: { status: "PROMPT_READY" },
      include: creationInclude,
    });

    log.info("Prompt generation completed", { userId, creationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Unexpected error in startPromptGeneration", {
      userId,
      creationId,
      error: message,
    });
    await failCreation(creationId, message).catch(() => {});
    return {
      ok: false,
      error: "Erro interno na geração de prompt.",
      code: "internal",
    };
  }
}

// ---------------------------------------------------------------------------
// Save edited prompt
// ---------------------------------------------------------------------------

/**
 * Saves the user's edited version of the generated VEO 3 prompt.
 * Only allowed when status is PROMPT_READY.
 */
export async function saveEditedPrompt(
  userId: string,
  creationId: string,
  promptText: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    if (creation.status !== "PROMPT_READY") {
      return {
        ok: false,
        error: `Edição de prompt requer status PROMPT_READY (atual: "${creation.status}").`,
        code: "invalid_state",
      };
    }

    if (!creation.prompt) {
      return {
        ok: false,
        error: "Prompt não encontrado para esta criação.",
        code: "not_found",
      };
    }

    await prisma.avatarVideoPrompt.update({
      where: { creationId },
      data: { promptText, isEdited: true, editedAt: new Date() },
    });

    const updated = await prisma.avatarVideoCreation.findUniqueOrThrow({
      where: { id: creationId },
      include: creationInclude,
    });

    log.info("Edited prompt saved", { userId, creationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to save edited prompt", {
      userId,
      creationId,
      error: message,
    });
    return {
      ok: false,
      error: "Erro ao salvar prompt editado.",
      code: "internal",
    };
  }
}

// ---------------------------------------------------------------------------
// Complete creation
// ---------------------------------------------------------------------------

/**
 * Marks the creation as COMPLETED — the user has finished the flow.
 * Only allowed when status is PROMPT_READY.
 */
export async function completeCreation(
  userId: string,
  creationId: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const loadResult = await loadOwnedCreation(creationId, userId);
    if (!loadResult.ok) return loadResult;
    const creation = loadResult.data;

    if (creation.status !== "PROMPT_READY") {
      return {
        ok: false,
        error: `Finalizar criação requer status PROMPT_READY (atual: "${creation.status}").`,
        code: "invalid_state",
      };
    }

    const updated = await prisma.avatarVideoCreation.update({
      where: { id: creationId },
      data: { status: "COMPLETED" },
      include: creationInclude,
    });

    log.info("Creation completed", { userId, creationId });
    return { ok: true, data: toCreationDTO(updated) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to complete creation", {
      userId,
      creationId,
      error: message,
    });
    return { ok: false, error: "Erro ao finalizar criação.", code: "internal" };
  }
}

// ---------------------------------------------------------------------------
// Get creation detail
// ---------------------------------------------------------------------------

/**
 * Returns a single creation with all relations.
 * Returns `not_found` if the creation does not exist or belongs to another user.
 */
export async function getCreationDetail(
  userId: string,
  creationId: string,
): Promise<ServiceResult<CreationDTO>> {
  try {
    const result = await loadOwnedCreation(creationId, userId);
    if (!result.ok) return result;
    return { ok: true, data: toCreationDTO(result.data) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to load creation", {
      userId,
      creationId,
      error: message,
    });
    return { ok: false, error: "Erro ao carregar criação.", code: "internal" };
  }
}

// ---------------------------------------------------------------------------
// List creations for user
// ---------------------------------------------------------------------------

/**
 * Returns paginated creations for the user (most recent first).
 */
export async function listCreations(
  userId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<ServiceResult<CreationDTO[]>> {
  try {
    const limit = Math.min(opts.limit ?? 20, 100);

    const creations = await prisma.avatarVideoCreation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      include: creationInclude,
    });

    return { ok: true, data: creations.map(toCreationDTO) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Failed to list creations", { userId, error: message });
    return { ok: false, error: "Erro ao listar criações.", code: "internal" };
  }
}
