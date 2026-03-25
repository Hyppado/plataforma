/**
 * Tests: lib/lgpd/erasure.ts — LGPD data erasure pipeline
 *
 * Priority: #1 (Security/Compliance — user data deletion)
 * Coverage: request creation (dedup), processErasure pipeline,
 *           rejection, error rollback, audit trail
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { buildUser, buildErasureRequest } from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import {
  createErasureRequest,
  processErasure,
  rejectErasure,
} from "@/lib/lgpd/erasure";

describe("createErasureRequest()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new erasure request when none pending", async () => {
    prismaMock.dataErasureRequest.findFirst.mockResolvedValue(null);
    prismaMock.dataErasureRequest.create.mockResolvedValue({
      id: "req-1",
      userId: "user-1",
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    const id = await createErasureRequest("user-1");
    expect(id).toBe("req-1");
    expect(prismaMock.dataErasureRequest.create).toHaveBeenCalledOnce();
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("returns existing request ID if one is already pending", async () => {
    prismaMock.dataErasureRequest.findFirst.mockResolvedValue({
      id: "existing-req",
    });

    const id = await createErasureRequest("user-1");
    expect(id).toBe("existing-req");
    expect(prismaMock.dataErasureRequest.create).not.toHaveBeenCalled();
  });

  it("creates audit log with correct action", async () => {
    prismaMock.dataErasureRequest.findFirst.mockResolvedValue(null);
    prismaMock.dataErasureRequest.create.mockResolvedValue({
      id: "req-2",
      userId: "user-1",
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    await createErasureRequest("user-1");
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DATA_ERASURE_REQUESTED",
          entityType: "DataErasureRequest",
        }),
      }),
    );
  });
});

describe("processErasure()", () => {
  const user = buildUser({ id: "user-1" });

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.dataErasureRequest.findUnique.mockResolvedValue({
      id: "req-1",
      userId: "user-1",
      status: "PENDING",
      user,
    });
    prismaMock.dataErasureRequest.update.mockResolvedValue({});
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.accessGrant.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.alert.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.collection.findMany.mockResolvedValue([
      { id: "col-1" },
      { id: "col-2" },
    ]);
    prismaMock.collectionItem.deleteMany.mockResolvedValue({ count: 5 });
    prismaMock.collection.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.savedItem.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.note.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.hotmartIdentity.findUnique.mockResolvedValue({
      id: "ident-1",
      userId: "user-1",
    });
    prismaMock.hotmartIdentity.update.mockResolvedValue({});
    prismaMock.usageEvent.deleteMany.mockResolvedValue({ count: 10 });
    prismaMock.usagePeriod.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it("processes full erasure pipeline successfully", async () => {
    const result = await processErasure("req-1", "admin-1");
    expect(result.success).toBe(true);
    expect(result.anonymizedFields.length).toBeGreaterThan(0);
  });

  it("anonymizes user email to anon.hyppado domain", async () => {
    await processErasure("req-1", "admin-1");

    const updateCall = prismaMock.user.update.mock.calls[0][0];
    expect(updateCall.data.email).toMatch(/^deleted_[a-f0-9]+@anon\.hyppado$/);
  });

  it("sets user status to INACTIVE", async () => {
    await processErasure("req-1", "admin-1");

    const updateCall = prismaMock.user.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("INACTIVE");
    expect(updateCall.data.deletedAt).toBeTruthy();
  });

  it("nullifies passwordHash", async () => {
    await processErasure("req-1", "admin-1");

    const updateCall = prismaMock.user.update.mock.calls[0][0];
    expect(updateCall.data.passwordHash).toBeNull();
  });

  it("cancels active subscriptions", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: { in: ["ACTIVE", "PAST_DUE", "PENDING"] },
        }),
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });

  it("revokes active access grants", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.accessGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("deletes user content (alerts, collections, saved items, notes)", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.alert.deleteMany).toHaveBeenCalled();
    expect(prismaMock.collection.deleteMany).toHaveBeenCalled();
    expect(prismaMock.savedItem.deleteMany).toHaveBeenCalled();
    expect(prismaMock.note.deleteMany).toHaveBeenCalled();
  });

  it("anonymizes HotmartIdentity buyerEmail", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.hotmartIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buyerEmail: null }),
      }),
    );
  });

  it("deletes usage events and periods", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.usageEvent.deleteMany).toHaveBeenCalled();
    expect(prismaMock.usagePeriod.deleteMany).toHaveBeenCalled();
  });

  it("creates completion audit log", async () => {
    await processErasure("req-1", "admin-1");
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DATA_ERASURE_COMPLETED",
          actorId: "admin-1",
        }),
      }),
    );
  });

  it("returns failure for non-PENDING request", async () => {
    prismaMock.dataErasureRequest.findUnique.mockResolvedValue({
      id: "req-1",
      status: "COMPLETED",
    });

    const result = await processErasure("req-1", "admin-1");
    expect(result.success).toBe(false);
    expect(result.anonymizedFields).toEqual([]);
  });

  it("returns failure when request not found", async () => {
    prismaMock.dataErasureRequest.findUnique.mockResolvedValue(null);

    const result = await processErasure("req-1", "admin-1");
    expect(result.success).toBe(false);
  });

  it("rolls back status to PENDING on error", async () => {
    prismaMock.subscription.updateMany.mockRejectedValue(
      new Error("DB connection lost"),
    );

    await expect(processErasure("req-1", "admin-1")).rejects.toThrow(
      "DB connection lost",
    );

    // Should have reverted status to PENDING
    const lastUpdateCall =
      prismaMock.dataErasureRequest.update.mock.calls.at(-1)?.[0];
    expect(lastUpdateCall?.data?.status).toBe("PENDING");
  });
});

describe("rejectErasure()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dataErasureRequest.update.mockResolvedValue({});
    prismaMock.dataErasureRequest.findUnique.mockResolvedValue({
      id: "req-1",
      userId: "user-1",
    });
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it("updates request status to REJECTED with reason", async () => {
    await rejectErasure("req-1", "admin-1", "Legal hold");

    expect(prismaMock.dataErasureRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          notes: "Legal hold",
        }),
      }),
    );
  });

  it("creates rejection audit log", async () => {
    await rejectErasure("req-1", "admin-1", "Legal hold");

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DATA_ERASURE_REJECTED",
          actorId: "admin-1",
        }),
      }),
    );
  });
});
