/**
 * Tests: lib/echotik/cron/cleanupOrphans.ts
 *
 * Covers: product detail orphan cleanup, creator blob orphan cleanup,
 * and graceful error handling for blob/DB failures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  echotikProductTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  echotikCreatorTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  echotikProductDetail: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

const deleteBlobsMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const listBlobsByPrefixMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/storage/blob", () => ({
  deleteBlobs: deleteBlobsMock,
  listBlobsByPrefix: listBlobsByPrefixMock,
}));

import { cleanupOrphanedBlobs } from "@/lib/echotik/cron/cleanupOrphans";

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => log),
  correlationId: "test",
};

// ---------------------------------------------------------------------------
// cleanupOrphanedBlobs — product details
// ---------------------------------------------------------------------------

describe("cleanupOrphanedBlobs() — product details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing to clean up
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 0 });
    deleteBlobsMock.mockResolvedValue(0);
    listBlobsByPrefixMock.mockResolvedValue([]);
  });

  it("returns zeros when no orphaned product details exist", async () => {
    // All products in trend table match all product detail records
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-1" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(0);
    expect(result.productBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes blob and DB row for orphaned product with blobUrl", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      {
        id: "detail-1",
        productExternalId: "prod-orphan",
        blobUrl: "https://blob.example.com/products/prod-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockResolvedValue(1);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productBlobsDeleted).toBe(1);
    expect(result.productDetailsDeleted).toBe(1);
    expect(deleteBlobsMock).toHaveBeenCalledWith([
      "https://blob.example.com/products/prod-orphan.jpg",
    ]);
    expect(prismaMock.echotikProductDetail.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["detail-1"] } },
      }),
    );
  });

  it("deletes DB row for orphaned product without blobUrl", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      { id: "detail-2", productExternalId: "prod-orphan", blobUrl: null },
    ]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(1);
    expect(result.productBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("skips DB deletion when blob deletion throws", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      {
        id: "detail-3",
        productExternalId: "prod-orphan",
        blobUrl: "https://blob.example.com/products/prod-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockRejectedValue(new Error("Blob API unavailable"));

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(0);
    expect(result.productBlobsDeleted).toBe(0);
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("blob deletion failed"),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// cleanupOrphanedBlobs — creator avatars
// ---------------------------------------------------------------------------

describe("cleanupOrphanedBlobs() — creator avatar blobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no orphaned product details — isolate creator-only behavior
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 0 });
    deleteBlobsMock.mockResolvedValue(0);
    listBlobsByPrefixMock.mockResolvedValue([]);
  });

  it("returns zero when no creator blobs exist in storage", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-1" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("skips blobs whose userExternalId is still active in trend table", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-active" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([
      {
        url: "https://blob.example.com/creators/user-active.jpg",
        pathname: "creators/user-active.jpg",
      },
    ]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("deletes blob for creator no longer in trend table", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-active" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([
      {
        url: "https://blob.example.com/creators/user-active.jpg",
        pathname: "creators/user-active.jpg",
      },
      {
        url: "https://blob.example.com/creators/user-orphan.jpg",
        pathname: "creators/user-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockResolvedValue(1);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(1);
    expect(deleteBlobsMock).toHaveBeenCalledWith([
      "https://blob.example.com/creators/user-orphan.jpg",
    ]);
  });

  it("returns zero and logs warning when listBlobsByPrefix throws", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    listBlobsByPrefixMock.mockRejectedValue(new Error("Blob list failed"));

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("creator blobs"),
      expect.any(Object),
    );
  });
});
