/**
 * Tests: lib/hotmart/plans.ts — Hotmart plan sync and resolution
 *
 * Coverage: listProducts, getProductByNumericId, listPlansForProduct,
 *           syncPlansFromHotmart, resolveOrSyncPlan
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { buildPlan } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

// Mock the Hotmart API client
vi.mock("@/lib/hotmart/client", () => ({
  hotmartRequest: vi.fn(),
}));

import {
  listProducts,
  getProductByNumericId,
  listPlansForProduct,
  syncPlansFromHotmart,
  resolveOrSyncPlan,
} from "@/lib/hotmart/plans";
import { hotmartRequest } from "@/lib/hotmart/client";

const mockHotmartRequest = vi.mocked(hotmartRequest);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const hotmartProduct = {
  id: 7420891,
  ucode: "abc-uuid-123",
  name: "Hyppado Pro",
  status: "ACTIVE",
  is_subscription: true,
  format: "SUBSCRIPTION",
};

const hotmartPlan = {
  code: "tz12qeev",
  name: "Pro Mensal",
  description: "Plano mensal profissional",
  periodicity: "MONTHLY",
  price: { value: 59.9, currency_code: "BRL" },
  payment_mode: "SUBSCRIPTION",
  max_installments: 1,
};

const hotmartPlanAnnual = {
  code: "an99xyzw",
  name: "Pro Anual",
  description: "Plano anual com desconto",
  periodicity: "ANNUAL",
  price: { value: 599.0, currency_code: "BRL" },
  payment_mode: "SUBSCRIPTION",
  max_installments: 12,
};

describe("listProducts()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches products from Hotmart API", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartProduct],
    });

    const products = await listProducts();

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/products/api/v1/products",
      { params: {} },
    );
    expect(products).toHaveLength(1);
    expect(products[0].ucode).toBe("abc-uuid-123");
  });

  it("passes filter params", async () => {
    mockHotmartRequest.mockResolvedValue({ items: [] });

    await listProducts({ id: 7420891, status: "ACTIVE" });

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/products/api/v1/products",
      { params: { id: 7420891, status: "ACTIVE" } },
    );
  });

  it("returns empty array on empty response", async () => {
    mockHotmartRequest.mockResolvedValue({ items: [] });

    const products = await listProducts();
    expect(products).toEqual([]);
  });
});

describe("getProductByNumericId()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns product matching numeric ID", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartProduct],
    });

    const product = await getProductByNumericId(7420891);

    expect(product).not.toBeNull();
    expect(product!.id).toBe(7420891);
    expect(product!.ucode).toBe("abc-uuid-123");
  });

  it("returns null if not found", async () => {
    mockHotmartRequest.mockResolvedValue({ items: [] });

    const product = await getProductByNumericId(999999);
    expect(product).toBeNull();
  });
});

describe("listPlansForProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches plans for product ucode", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan, hotmartPlanAnnual],
    });

    const plans = await listPlansForProduct("abc-uuid-123");

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/products/api/v1/products/abc-uuid-123/plans",
    );
    expect(plans).toHaveLength(2);
    expect(plans[0].code).toBe("tz12qeev");
    expect(plans[1].periodicity).toBe("ANNUAL");
  });
});

describe("syncPlansFromHotmart()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates new plans from Hotmart API", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan],
    });
    prismaMock.plan.findUnique.mockResolvedValue(null);
    prismaMock.plan.create.mockResolvedValue({
      id: "new-plan-id",
      code: "hotmart_tz12qeev",
      name: "Pro Mensal",
      hotmartPlanCode: "tz12qeev",
    });

    const result = await syncPlansFromHotmart("abc-uuid-123");

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(prismaMock.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "hotmart_tz12qeev",
          name: "Pro Mensal",
          hotmartPlanCode: "tz12qeev",
          priceAmount: 5990,
          currency: "BRL",
          periodicity: "MONTHLY",
        }),
      }),
    );
  });

  it("updates existing plans without overwriting quotas", async () => {
    const existingPlan = buildPlan({
      id: "existing-plan",
      code: "hotmart_tz12qeev",
      hotmartPlanCode: "tz12qeev",
      transcriptsPerMonth: 200, // Admin-customized quota
    });

    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan],
    });
    prismaMock.plan.findUnique.mockResolvedValue(existingPlan);
    prismaMock.plan.update.mockResolvedValue(existingPlan);

    const result = await syncPlansFromHotmart("abc-uuid-123");

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    // Should NOT update quotas
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-plan" },
        data: expect.not.objectContaining({
          transcriptsPerMonth: expect.anything(),
        }),
      }),
    );
  });

  it("maps ANNUAL periodicity correctly", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlanAnnual],
    });
    prismaMock.plan.findUnique.mockResolvedValue(null);
    prismaMock.plan.create.mockResolvedValue({
      id: "annual-plan",
      code: "hotmart_an99xyzw",
      name: "Pro Anual",
      hotmartPlanCode: "an99xyzw",
    });

    await syncPlansFromHotmart("abc-uuid-123");

    expect(prismaMock.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodicity: "ANNUAL",
        }),
      }),
    );
  });
});

describe("resolveOrSyncPlan()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing plan by hotmartPlanCode", async () => {
    prismaMock.plan.findUnique.mockResolvedValue({ id: "plan-abc" });

    const result = await resolveOrSyncPlan("tz12qeev");

    expect(result).toEqual({ id: "plan-abc" });
    expect(prismaMock.plan.findUnique).toHaveBeenCalledWith({
      where: { hotmartPlanCode: "tz12qeev" },
      select: { id: true },
    });
  });

  it("auto-syncs from Hotmart and resolves plan", async () => {
    // First call: not found
    prismaMock.plan.findUnique
      .mockResolvedValueOnce(null) // initial lookup
      .mockResolvedValueOnce(null) // inside syncPlansFromHotmart
      .mockResolvedValueOnce({ id: "synced-plan" }); // post-sync lookup

    // Mock product lookup + plan listing
    mockHotmartRequest
      .mockResolvedValueOnce({ items: [hotmartProduct] }) // getProductByNumericId
      .mockResolvedValueOnce({ items: [hotmartPlan] }); // listPlansForProduct

    prismaMock.plan.create.mockResolvedValue({
      id: "synced-plan",
      code: "hotmart_tz12qeev",
      name: "Pro Mensal",
      hotmartPlanCode: "tz12qeev",
    });

    const result = await resolveOrSyncPlan("tz12qeev", "7420891");

    expect(result).toEqual({ id: "synced-plan" });
  });

  it("returns null if auto-sync fails gracefully", async () => {
    prismaMock.plan.findUnique.mockResolvedValue(null);
    mockHotmartRequest.mockRejectedValue(new Error("Hotmart API down"));

    const result = await resolveOrSyncPlan("tz12qeev", "7420891");

    expect(result).toBeNull();
  });

  it("returns null without productId when planCode not found", async () => {
    prismaMock.plan.findUnique.mockResolvedValue(null);

    const result = await resolveOrSyncPlan("unknown_code");

    expect(result).toBeNull();
  });

  it("returns null when Prisma findUnique throws (e.g. missing column)", async () => {
    prismaMock.plan.findUnique.mockRejectedValue(
      new Error(
        "The column `Plan.hotmartPlanCode` does not exist in the current database",
      ),
    );

    const result = await resolveOrSyncPlan("tz12qeev", "7420891");

    expect(result).toBeNull();
  });

  it("returns null when sync succeeds but post-sync lookup throws", async () => {
    prismaMock.plan.findUnique
      .mockRejectedValueOnce(new Error("column does not exist")) // initial lookup
      .mockRejectedValueOnce(new Error("column does not exist")); // would be called in sync

    const result = await resolveOrSyncPlan("tz12qeev", "7420891");

    expect(result).toBeNull();
  });
});

describe("syncPlansFromHotmart() — error handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("propagates Prisma findUnique error (missing column)", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan],
    });
    prismaMock.plan.findUnique.mockRejectedValue(
      new Error(
        "The column `Plan.hotmartPlanCode` does not exist in the current database",
      ),
    );

    await expect(syncPlansFromHotmart("abc-uuid-123")).rejects.toThrow(
      "does not exist",
    );
  });

  it("propagates Prisma create error (unique constraint)", async () => {
    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan],
    });
    prismaMock.plan.findUnique.mockResolvedValue(null);
    prismaMock.plan.create.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`code`)"),
    );

    await expect(syncPlansFromHotmart("abc-uuid-123")).rejects.toThrow(
      "Unique constraint",
    );
  });

  it("propagates Prisma update error", async () => {
    const existingPlan = buildPlan({
      id: "existing-plan",
      hotmartPlanCode: "tz12qeev",
    });

    mockHotmartRequest.mockResolvedValue({
      items: [hotmartPlan],
    });
    prismaMock.plan.findUnique.mockResolvedValue(existingPlan);
    prismaMock.plan.update.mockRejectedValue(
      new Error("Record to update not found"),
    );

    await expect(syncPlansFromHotmart("abc-uuid-123")).rejects.toThrow(
      "Record to update not found",
    );
  });

  it("propagates Hotmart API error from listPlansForProduct", async () => {
    mockHotmartRequest.mockRejectedValue(new Error("401 Unauthorized"));

    await expect(syncPlansFromHotmart("abc-uuid-123")).rejects.toThrow(
      "401 Unauthorized",
    );
  });
});
