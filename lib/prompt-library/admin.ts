/**
 * lib/prompt-library/admin.ts
 *
 * Admin service for managing PromptLibraryItem records.
 * Route handlers in app/api/admin/prompt-library/** must remain thin
 * and delegate all business logic to this module.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("prompt-library/admin");

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PromptLibraryItemDTO {
  id: string;
  title: string;
  category: string;
  description: string | null;
  videoBlobUrl: string;
  promptText: string;
  isActive: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface PromptLibraryItemInput {
  title: string;
  category: string;
  description?: string | null;
  videoBlobUrl: string;
  promptText: string;
  isActive?: boolean;
  createdById?: string | null;
}

export interface PromptLibraryItemUpdate {
  title?: string;
  category?: string;
  description?: string | null;
  videoBlobUrl?: string;
  promptText?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class PromptLibraryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptLibraryValidationError";
  }
}

function validateInput(input: PromptLibraryItemInput): void {
  if (!input.title?.trim()) {
    throw new PromptLibraryValidationError("title is required");
  }
  if (!input.category?.trim()) {
    throw new PromptLibraryValidationError("category is required");
  }
  if (!input.videoBlobUrl?.trim()) {
    throw new PromptLibraryValidationError("videoBlobUrl is required");
  }
  if (!input.promptText?.trim()) {
    throw new PromptLibraryValidationError("promptText is required");
  }
}

function validateUpdate(patch: PromptLibraryItemUpdate): void {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new PromptLibraryValidationError("title cannot be empty");
  }
  if (patch.category !== undefined && !patch.category.trim()) {
    throw new PromptLibraryValidationError("category cannot be empty");
  }
  if (patch.videoBlobUrl !== undefined && !patch.videoBlobUrl.trim()) {
    throw new PromptLibraryValidationError("videoBlobUrl cannot be empty");
  }
  if (patch.promptText !== undefined && !patch.promptText.trim()) {
    throw new PromptLibraryValidationError("promptText cannot be empty");
  }
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toDTO(
  item: {
    id: string;
    title: string;
    category: string;
    description: string | null;
    videoBlobUrl: string;
    promptText: string;
    isActive: boolean;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { name: string | null } | null;
  }
): PromptLibraryItemDTO {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description,
    videoBlobUrl: item.videoBlobUrl,
    promptText: item.promptText,
    isActive: item.isActive,
    createdById: item.createdById,
    createdByName: item.createdBy?.name ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const withCreatedBy = {
  createdBy: { select: { name: true } },
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Returns all prompt library items ordered by creation date descending.
 * Admin view: includes inactive items.
 */
export async function listAllPromptLibraryItems(): Promise<PromptLibraryItemDTO[]> {
  const items = await prisma.promptLibraryItem.findMany({
    orderBy: { createdAt: "desc" },
    include: withCreatedBy,
  });
  return items.map(toDTO);
}

/**
 * Returns a single prompt library item by id.
 * Returns null when not found.
 */
export async function getPromptLibraryItem(
  id: string
): Promise<PromptLibraryItemDTO | null> {
  const item = await prisma.promptLibraryItem.findUnique({
    where: { id },
    include: withCreatedBy,
  });
  return item ? toDTO(item) : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Creates a new prompt library item.
 * Throws PromptLibraryValidationError on invalid input.
 */
export async function createPromptLibraryItem(
  input: PromptLibraryItemInput
): Promise<PromptLibraryItemDTO> {
  validateInput(input);

  const item = await prisma.promptLibraryItem.create({
    data: {
      title: input.title.trim(),
      category: input.category.trim(),
      description: input.description?.trim() || null,
      videoBlobUrl: input.videoBlobUrl.trim(),
      promptText: input.promptText.trim(),
      isActive: input.isActive ?? true,
      createdById: input.createdById ?? null,
    },
    include: withCreatedBy,
  });

  log.info("Prompt library item created", { id: item.id, title: item.title });
  return toDTO(item);
}

/**
 * Updates an existing prompt library item.
 * Only the provided fields are changed (partial update).
 * Throws PromptLibraryValidationError on invalid field values.
 * Throws if the item does not exist.
 */
export async function updatePromptLibraryItem(
  id: string,
  patch: PromptLibraryItemUpdate
): Promise<PromptLibraryItemDTO> {
  validateUpdate(patch);

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.category !== undefined) data.category = patch.category.trim();
  if (patch.description !== undefined)
    data.description = patch.description?.trim() || null;
  if (patch.videoBlobUrl !== undefined)
    data.videoBlobUrl = patch.videoBlobUrl.trim();
  if (patch.promptText !== undefined)
    data.promptText = patch.promptText.trim();
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  const item = await prisma.promptLibraryItem.update({
    where: { id },
    data,
    include: withCreatedBy,
  });

  log.info("Prompt library item updated", { id });
  return toDTO(item);
}

/**
 * Deactivates a prompt library item (soft delete).
 * Prefer this over hard delete to preserve history.
 */
export async function deactivatePromptLibraryItem(
  id: string
): Promise<PromptLibraryItemDTO> {
  const item = await prisma.promptLibraryItem.update({
    where: { id },
    data: { isActive: false },
    include: withCreatedBy,
  });

  log.info("Prompt library item deactivated", { id });
  return toDTO(item);
}

/**
 * Permanently deletes a prompt library item.
 * Only use when the item has never been published to users.
 */
export async function deletePromptLibraryItem(id: string): Promise<void> {
  await prisma.promptLibraryItem.delete({ where: { id } });
  log.info("Prompt library item deleted", { id });
}
