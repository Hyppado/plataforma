/**
 * lib/avatar-video/admin.ts
 *
 * Admin service for managing AvatarProfile and VideoScenario records.
 * Route handlers in app/api/admin/avatar-video/** must remain thin and
 * call into this module.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("avatar-video/admin");

// ---------------------------------------------------------------------------
// Avatar profiles
// ---------------------------------------------------------------------------

export interface AvatarInput {
  name: string;
  description?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AvatarUpdate {
  name?: string;
  description?: string | null;
  imageUrl?: string;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function listAllAvatars() {
  return prisma.avatarProfile.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createAvatar(input: AvatarInput) {
  return prisma.avatarProfile.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl.trim(),
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateAvatar(id: string, patch: AvatarUpdate) {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined)
    data.description = patch.description?.trim() || null;
  if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl.trim();
  if (patch.thumbnailUrl !== undefined)
    data.thumbnailUrl = patch.thumbnailUrl?.trim() || null;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

  return prisma.avatarProfile.update({ where: { id }, data });
}

/**
 * Deletes an avatar if it has no creations referencing it; otherwise
 * deactivates it (soft-delete) and returns { deleted: false, deactivated: true }.
 */
export async function deleteOrDeactivateAvatar(id: string) {
  const referenced = await prisma.avatarVideoCreation.count({
    where: { avatarProfileId: id },
  });

  if (referenced > 0) {
    await prisma.avatarProfile.update({
      where: { id },
      data: { isActive: false },
    });
    log.info("Avatar deactivated (in use)", { id, references: referenced });
    return { deleted: false, deactivated: true } as const;
  }

  await prisma.avatarProfile.delete({ where: { id } });
  log.info("Avatar deleted", { id });
  return { deleted: true, deactivated: false } as const;
}

// ---------------------------------------------------------------------------
// Video scenarios
// ---------------------------------------------------------------------------

export interface ScenarioInput {
  name: string;
  description?: string | null;
  promptHint?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ScenarioUpdate {
  name?: string;
  description?: string | null;
  promptHint?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export async function listAllScenarios() {
  return prisma.videoScenario.findMany({
    orderBy: [
      { isDefault: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });
}

export async function createScenario(input: ScenarioInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.videoScenario.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.videoScenario.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        promptHint: input.promptHint?.trim() || null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  });
}

export async function updateScenario(id: string, patch: ScenarioUpdate) {
  return prisma.$transaction(async (tx) => {
    if (patch.isDefault === true) {
      await tx.videoScenario.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.description !== undefined)
      data.description = patch.description?.trim() || null;
    if (patch.promptHint !== undefined)
      data.promptHint = patch.promptHint?.trim() || null;
    if (patch.isDefault !== undefined) data.isDefault = patch.isDefault;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

    return tx.videoScenario.update({ where: { id }, data });
  });
}

export async function deleteOrDeactivateScenario(id: string) {
  const referenced = await prisma.avatarVideoCreation.count({
    where: { videoScenarioId: id },
  });

  if (referenced > 0) {
    await prisma.videoScenario.update({
      where: { id },
      data: { isActive: false },
    });
    log.info("Scenario deactivated (in use)", { id, references: referenced });
    return { deleted: false, deactivated: true } as const;
  }

  await prisma.videoScenario.delete({ where: { id } });
  log.info("Scenario deleted", { id });
  return { deleted: true, deactivated: false } as const;
}
