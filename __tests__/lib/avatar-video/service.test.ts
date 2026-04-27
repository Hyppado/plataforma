/**
 * Tests: lib/avatar-video/service.ts
 *
 * Coverage:
 *   - getOrCreateDraftCreation
 *   - updateCreationProduct
 *   - updateCreationSelections
 *   - startImageGeneration (quota enforcement, state transitions)
 *   - startPromptGeneration (state transitions, no-images guard)
 *   - saveEditedPrompt (state guard, persistence)
 *   - completeCreation (state guard)
 *   - getCreationDetail (ownership validation)
 *   - listCreations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@tests/helpers/prisma-mock";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  buildAvatarVideoCreation,
  buildAvatarVideoImageVariation,
  buildAvatarVideoPrompt,
} from "@tests/helpers/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  assertAvatarVideoQuotaMock,
  consumeAvatarVideoQuotaMock,
  quotaExceededToServiceErrMock,
} = vi.hoisted(() => ({
  assertAvatarVideoQuotaMock: vi.fn(),
  consumeAvatarVideoQuotaMock: vi.fn(),
  quotaExceededToServiceErrMock: vi.fn().mockReturnValue({
    ok: false,
    error: "Quota exceeded",
    code: "quota_exceeded",
  }),
}));

vi.mock("@/lib/avatar-video/quota", () => ({
  assertAvatarVideoQuota: assertAvatarVideoQuotaMock,
  consumeAvatarVideoQuota: consumeAvatarVideoQuotaMock,
  quotaExceededToServiceErr: quotaExceededToServiceErrMock,
}));

const { generateImageVariationMock } = vi.hoisted(() => ({
  generateImageVariationMock: vi.fn(),
}));

vi.mock("@/lib/avatar-video/image-prompt", () => ({
  buildImagePromptText: vi.fn().mockReturnValue("test prompt text"),
  generateImageVariation: generateImageVariationMock,
}));

const { generateAndPersistVeoPromptMock } = vi.hoisted(() => ({
  generateAndPersistVeoPromptMock: vi.fn(),
}));

vi.mock("@/lib/avatar-video/veo-prompt", () => ({
  generateAndPersistVeoPrompt: generateAndPersistVeoPromptMock,
}));

vi.mock("@/lib/usage", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {
    action: string;
    used: number;
    limit: number;
    constructor(action: string, used: number, limit: number) {
      super(`Quota exceeded for ${action}`);
      this.name = "QuotaExceededError";
      this.action = action;
      this.used = used;
      this.limit = limit;
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  getOrCreateDraftCreation,
  updateCreationProduct,
  updateCreationSelections,
  startImageGeneration,
  startPromptGeneration,
  saveEditedPrompt,
  completeCreation,
  getCreationDetail,
  listCreations,
} from "@/lib/avatar-video/service";
import { QuotaExceededError } from "@/lib/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDraft(overrides: Record<string, unknown> = {}) {
  return buildAvatarVideoCreation({
    id: "creation-1",
    userId: "user-1",
    status: "DRAFT",
    imageVariations: [],
    prompt: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// getOrCreateDraftCreation
// ---------------------------------------------------------------------------

describe("getOrCreateDraftCreation()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing DRAFT creation when one exists", async () => {
    const existing = makeDraft();
    (
      prismaMock.avatarVideoCreation.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(existing);

    const result = await getOrCreateDraftCreation("user-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("creation-1");
      expect(result.data.status).toBe("DRAFT");
    }
    expect(prismaMock.avatarVideoCreation.create).not.toHaveBeenCalled();
  });

  it("creates a new DRAFT when none exists", async () => {
    const newCreation = makeDraft({ id: "creation-new" });
    (
      prismaMock.avatarVideoCreation.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.avatarVideoCreation.create as ReturnType<typeof vi.fn>
    ).mockResolvedValue(newCreation);

    const result = await getOrCreateDraftCreation("user-1");

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", status: "DRAFT" }),
      }),
    );
  });

  it("returns internal error when DB throws", async () => {
    (
      prismaMock.avatarVideoCreation.findFirst as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("DB error"));

    const result = await getOrCreateDraftCreation("user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("internal");
  });
});

// ---------------------------------------------------------------------------
// updateCreationProduct
// ---------------------------------------------------------------------------

describe("updateCreationProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  const product = {
    productExternalId: "prod-123",
    productName: "Test Product",
    productImageUrl: "https://img.test/p.jpg",
    productSelectedImageUrl: "https://img.test/p.jpg",
    productPriceCents: 1990,
    productCurrency: "BRL",
    productCategory: "Beleza",
  };

  it("saves product data on DRAFT creation", async () => {
    const creation = makeDraft();
    const updated = { ...creation, productName: "Test Product" };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(updated);

    const result = await updateCreationProduct("user-1", "creation-1", product);

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productName: "Test Product" }),
      }),
    );
  });

  it("returns not_found when creation does not exist", async () => {
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await updateCreationProduct("user-1", "creation-1", product);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found when creation belongs to a different user", async () => {
    const creation = makeDraft({ userId: "other-user" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await updateCreationProduct("user-1", "creation-1", product);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns invalid_state when creation is not DRAFT", async () => {
    const creation = makeDraft({ status: "IMAGES_READY" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await updateCreationProduct("user-1", "creation-1", product);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });
});

// ---------------------------------------------------------------------------
// updateCreationSelections
// ---------------------------------------------------------------------------

describe("updateCreationSelections()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates avatarProfileId on DRAFT creation", async () => {
    const creation = makeDraft();
    const updated = { ...creation, avatarProfileId: "avatar-1" };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(updated);

    const result = await updateCreationSelections("user-1", "creation-1", {
      avatarProfileId: "avatar-1",
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarProfile: { connect: { id: "avatar-1" } },
        }),
      }),
    );
  });

  it("returns invalid_state when creation is not DRAFT", async () => {
    const creation = makeDraft({ status: "PENDING_IMAGES" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await updateCreationSelections("user-1", "creation-1", {
      avatarProfileId: "avatar-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });

  it("connects videoScenario on DRAFT creation", async () => {
    const creation = makeDraft();
    const updated = { ...creation, videoScenarioId: "scenario-1" };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(updated);

    const result = await updateCreationSelections("user-1", "creation-1", {
      videoScenarioId: "scenario-1",
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          videoScenario: { connect: { id: "scenario-1" } },
        }),
      }),
    );
  });

  it("disconnects videoScenario and stores customScenarioDescription", async () => {
    const creation = makeDraft({ videoScenarioId: "scenario-1" });
    const updated = {
      ...creation,
      videoScenarioId: null,
      customScenarioDescription: "My custom scene",
    };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(updated);

    const result = await updateCreationSelections("user-1", "creation-1", {
      videoScenarioId: null,
      customScenarioDescription: "My custom scene",
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          videoScenario: { disconnect: true },
          customScenarioDescription: "My custom scene",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// startImageGeneration
// ---------------------------------------------------------------------------

describe("startImageGeneration()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invalid_state when status is not DRAFT, IMAGES_READY, or FAILED", async () => {
    const creation = makeDraft({ status: "COMPLETED" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
    expect(assertAvatarVideoQuotaMock).not.toHaveBeenCalled();
  });

  it("returns invalid_state when no product selected", async () => {
    const creation = makeDraft({ productExternalId: null });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_state");
      expect(result.error).toContain("produto");
    }
  });

  it("returns quota_exceeded when quota is exhausted", async () => {
    const creation = makeDraft({ productExternalId: "prod-1" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    assertAvatarVideoQuotaMock.mockRejectedValue(
      new QuotaExceededError("AVATAR_VIDEO_GENERATION", 5, 5),
    );

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("quota_exceeded");
    expect(quotaExceededToServiceErrMock).toHaveBeenCalled();
  });

  it("transitions to IMAGES_READY and consumes quota on success", async () => {
    const creation = makeDraft({ productExternalId: "prod-1" });
    const updatedCreation = {
      ...creation,
      status: "IMAGES_READY",
      imageVariations: [],
    };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    assertAvatarVideoQuotaMock.mockResolvedValue(undefined);
    (prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...creation, status: "PENDING_IMAGES" }) // transition to PENDING_IMAGES
      .mockResolvedValueOnce(updatedCreation); // transition to IMAGES_READY
    generateImageVariationMock
      .mockResolvedValueOnce({
        ok: true,
        data: { variationId: "v1", blobUrl: "https://b/1.jpg" },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { variationId: "v2", blobUrl: "https://b/2.jpg" },
      });
    consumeAvatarVideoQuotaMock.mockResolvedValue(undefined);

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(true);
    expect(consumeAvatarVideoQuotaMock).toHaveBeenCalledWith(
      "user-1",
      "creation-1",
    );
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "IMAGES_READY" },
        include: expect.anything(),
      }),
    );
  });

  it("marks creation FAILED when image generation fails", async () => {
    const creation = makeDraft({ productExternalId: "prod-1" });

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    assertAvatarVideoQuotaMock.mockResolvedValue(undefined);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    generateImageVariationMock
      .mockResolvedValueOnce({
        ok: true,
        data: { variationId: "v1", blobUrl: "https://b/1.jpg" },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "API unavailable",
        code: "internal",
      });

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    expect(consumeAvatarVideoQuotaMock).not.toHaveBeenCalled();
    // Should have called update with FAILED status
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("regenerates from IMAGES_READY: deletes existing variations and transitions to IMAGES_READY", async () => {
    const creation = makeDraft({
      status: "IMAGES_READY",
      productExternalId: "prod-1",
    });
    const updatedCreation = {
      ...creation,
      status: "IMAGES_READY",
      imageVariations: [],
    };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    assertAvatarVideoQuotaMock.mockResolvedValue(undefined);
    (
      prismaMock.avatarVideoImageVariation.deleteMany as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue({ count: 2 });
    (prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...creation, status: "PENDING_IMAGES" })
      .mockResolvedValueOnce(updatedCreation);
    generateImageVariationMock
      .mockResolvedValueOnce({
        ok: true,
        data: { variationId: "v1", blobUrl: "https://b/1.jpg" },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { variationId: "v2", blobUrl: "https://b/2.jpg" },
      });
    consumeAvatarVideoQuotaMock.mockResolvedValue(undefined);

    const result = await startImageGeneration("user-1", "creation-1");

    expect(result.ok).toBe(true);
    expect(
      prismaMock.avatarVideoImageVariation.deleteMany,
    ).toHaveBeenCalledWith({
      where: { creationId: "creation-1" },
    });
    expect(consumeAvatarVideoQuotaMock).toHaveBeenCalledWith(
      "user-1",
      "creation-1",
    );
  });
});

// ---------------------------------------------------------------------------
// startPromptGeneration
// ---------------------------------------------------------------------------

describe("startPromptGeneration()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invalid_state when status is not IMAGES_READY or PROMPT_READY", async () => {
    const creation = makeDraft({ status: "DRAFT" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await startPromptGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });

  it("returns invalid_state when no READY image variations exist", async () => {
    const pendingVariation = buildAvatarVideoImageVariation({
      status: "PENDING",
    });
    const creation = makeDraft({
      status: "IMAGES_READY",
      imageVariations: [pendingVariation],
    });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await startPromptGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_state");
      expect(result.error).toContain("imagem");
    }
  });

  it("transitions to PROMPT_READY on success", async () => {
    const readyVariation = buildAvatarVideoImageVariation({
      status: "READY",
      blobUrl: "https://blob/img.jpg",
    });
    const creation = makeDraft({
      status: "IMAGES_READY",
      imageVariations: [readyVariation],
    });
    const promptReadyCreation = {
      ...creation,
      status: "PROMPT_READY",
      prompt: null,
    };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...creation, status: "PENDING_PROMPT" })
      .mockResolvedValueOnce(promptReadyCreation);
    generateAndPersistVeoPromptMock.mockResolvedValue({
      ok: true,
      data: { promptJson: { prompt: "A video" }, promptText: "A video" },
    });

    const result = await startPromptGeneration("user-1", "creation-1");

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PROMPT_READY" },
        include: expect.anything(),
      }),
    );
  });

  it("allows regeneration from PROMPT_READY status", async () => {
    const readyVariation = buildAvatarVideoImageVariation({
      status: "READY",
      blobUrl: "https://blob/img.jpg",
    });
    const creation = makeDraft({
      status: "PROMPT_READY",
      imageVariations: [readyVariation],
    });

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...creation,
      status: "PROMPT_READY",
      prompt: null,
    });
    generateAndPersistVeoPromptMock.mockResolvedValue({
      ok: true,
      data: { promptJson: { prompt: "Updated" }, promptText: "Updated" },
    });

    const result = await startPromptGeneration("user-1", "creation-1");

    // Should not be blocked by status check
    expect(result.ok).toBe(true);
  });

  it("marks creation FAILED and returns ServiceErr when prompt generation fails", async () => {
    const readyVariation = buildAvatarVideoImageVariation({ status: "READY" });
    const creation = makeDraft({
      status: "IMAGES_READY",
      imageVariations: [readyVariation],
    });

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarProfile.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.videoScenario.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    generateAndPersistVeoPromptMock.mockResolvedValue({
      ok: false,
      error: "OpenAI API error",
      code: "internal",
    });

    const result = await startPromptGeneration("user-1", "creation-1");

    expect(result.ok).toBe(false);
    // failCreation should have been called
    expect(prismaMock.avatarVideoCreation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// saveEditedPrompt
// ---------------------------------------------------------------------------

describe("saveEditedPrompt()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the edited prompt text", async () => {
    const promptRow = buildAvatarVideoPrompt({ creationId: "creation-1" });
    const creation = makeDraft({ status: "PROMPT_READY", prompt: promptRow });

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(creation); // loadOwnedCreation
    (
      prismaMock.avatarVideoPrompt.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(promptRow);
    (
      prismaMock.avatarVideoCreation.findUniqueOrThrow as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue(creation);

    const result = await saveEditedPrompt(
      "user-1",
      "creation-1",
      "My custom prompt",
    );

    expect(result.ok).toBe(true);
    expect(prismaMock.avatarVideoPrompt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creationId: "creation-1" },
        data: expect.objectContaining({
          promptText: "My custom prompt",
          isEdited: true,
        }),
      }),
    );
  });

  it("returns invalid_state when status is not PROMPT_READY", async () => {
    const creation = makeDraft({ status: "IMAGES_READY" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await saveEditedPrompt("user-1", "creation-1", "text");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });

  it("returns not_found when no prompt row exists", async () => {
    const creation = makeDraft({ status: "PROMPT_READY", prompt: null });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await saveEditedPrompt("user-1", "creation-1", "text");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// completeCreation
// ---------------------------------------------------------------------------

describe("completeCreation()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("transitions PROMPT_READY to COMPLETED", async () => {
    const creation = makeDraft({ status: "PROMPT_READY" });
    const completed = { ...creation, status: "COMPLETED" };

    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);
    (
      prismaMock.avatarVideoCreation.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue(completed);

    const result = await completeCreation("user-1", "creation-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("COMPLETED");
  });

  it("returns invalid_state when status is not PROMPT_READY", async () => {
    const creation = makeDraft({ status: "DRAFT" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await completeCreation("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });
});

// ---------------------------------------------------------------------------
// getCreationDetail
// ---------------------------------------------------------------------------

describe("getCreationDetail()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns creation when it belongs to the user", async () => {
    const creation = makeDraft();
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await getCreationDetail("user-1", "creation-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("creation-1");
  });

  it("returns not_found for non-existent creation", async () => {
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await getCreationDetail("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found when creation belongs to another user", async () => {
    const creation = makeDraft({ userId: "attacker-user" });
    (
      prismaMock.avatarVideoCreation.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creation);

    const result = await getCreationDetail("user-1", "creation-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// listCreations
// ---------------------------------------------------------------------------

describe("listCreations()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated list for the user", async () => {
    const creations = [makeDraft({ id: "c-1" }), makeDraft({ id: "c-2" })];
    (
      prismaMock.avatarVideoCreation.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue(creations);

    const result = await listCreations("user-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe("c-1");
    }
    expect(prismaMock.avatarVideoCreation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("caps limit at 100", async () => {
    (
      prismaMock.avatarVideoCreation.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    await listCreations("user-1", { limit: 9999 });

    expect(prismaMock.avatarVideoCreation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("returns internal error when DB throws", async () => {
    (
      prismaMock.avatarVideoCreation.findMany as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("DB connection lost"));

    const result = await listCreations("user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("internal");
  });
});
