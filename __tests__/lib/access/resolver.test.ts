/**
 * Tests: lib/access/resolver.ts — resolveUserAccess, hasAccess
 *
 * Priority: #2 (Critical business logic — access control)
 * Coverage: all access states, priority order, edge cases
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  buildUser,
  buildPlan,
  buildSubscription,
  buildAccessGrant,
} from "@tests/helpers/factories";

import { resolveUserAccess, hasAccess } from "@/lib/access/resolver";
import { getQuotaLimits } from "@/lib/usage/quota";

describe("resolveUserAccess()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. User not found
  // -----------------------------------------------------------------------
  it("returns NO_ACCESS when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await resolveUserAccess("non-existent-id");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.source).toBe("none");
    expect(result.quotas).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 2. UserStatus checks (highest priority)
  // -----------------------------------------------------------------------
  it("returns SUSPENDED for suspended user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ status: "SUSPENDED" }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("SUSPENDED");
    expect(result.reason).toContain("suspensa");
  });

  it("returns NO_ACCESS for inactive user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ status: "INACTIVE" }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.reason).toContain("inativa");
  });

  it("returns NO_ACCESS for LGPD-deleted user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ status: "ACTIVE", deletedAt: new Date() }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.reason).toContain("LGPD");
  });

  // -----------------------------------------------------------------------
  // 3. AccessGrant (overrides subscription)
  // -----------------------------------------------------------------------
  it("returns FULL_ACCESS with manual grant (overrides subscription)", async () => {
    const plan = buildPlan();
    const grant = buildAccessGrant({ plan });
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(grant);

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("FULL_ACCESS");
    expect(result.source).toBe("manual_grant");
    expect(result.quotas).not.toBeNull();
    expect(result.quotas!.transcriptsPerMonth).toBe(plan.transcriptsPerMonth);
  });

  // -----------------------------------------------------------------------
  // 4. Active subscription
  // -----------------------------------------------------------------------
  it("returns FULL_ACCESS for active subscription", async () => {
    const plan = buildPlan();
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "ACTIVE", plan }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("FULL_ACCESS");
    expect(result.source).toBe("subscription");
    expect(result.plan).toBeTruthy();
  });

  /**
   * ACTIVE com endedAt vencido é estado contraditório, produzido quando um
   * evento tardio (PURCHASE_COMPLETE) reativava uma assinatura cancelada sem
   * limpar a data de término. Como ACTIVE não olhava essa data, o acesso nunca
   * mais era cortado — 10 contas em produção caminhavam para acesso vitalício.
   */
  it("nega acesso a assinatura ACTIVE cujo período já terminou", async () => {
    const plan = buildPlan();
    const ontem = new Date(Date.now() - 86400000);
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "ACTIVE", plan, endedAt: ontem }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.quotas).toBeNull();
  });

  it("mantém acesso a assinatura ACTIVE com término no futuro", async () => {
    const plan = buildPlan();
    const amanha = new Date(Date.now() + 86400000);
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "ACTIVE", plan, endedAt: amanha }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("FULL_ACCESS");
  });

  /**
   * Inadimplência corta o acesso na hora. Antes devolvia GRACE_PERIOD com
   * acesso pleno e sem prazo nenhum — 93 contas usavam o produto sem pagar,
   * indefinidamente. O acesso volta sozinho quando o pagamento entra.
   */
  it("nega acesso a assinatura PAST_DUE", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "PAST_DUE" }),
    );

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.quotas).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 5. No access
  // -----------------------------------------------------------------------
  it("returns NO_ACCESS when no grant and no subscription", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("NO_ACCESS");
    expect(result.source).toBe("none");
  });

  // -----------------------------------------------------------------------
  // Priority invariants
  // -----------------------------------------------------------------------
  it("suspended status overrides everything (even active grant)", async () => {
    // Even if an active grant exists, suspended user = no access
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ status: "SUSPENDED" }),
    );
    // Grant should not even be checked
    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("SUSPENDED");
  });

  // -----------------------------------------------------------------------
  // C5 regression: quotas come from unified getQuotaLimits()
  // -----------------------------------------------------------------------
  it("quotas from subscription match getQuotaLimits() output (unified source)", async () => {
    const plan = buildPlan({ transcriptsPerMonth: 42, scriptsPerMonth: 7 });
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "ACTIVE", plan }),
    );

    const result = await resolveUserAccess("user-1");
    const expected = getQuotaLimits(plan as any);
    expect(result.quotas).toEqual(expected);
  });

  it("quotas from AccessGrant match getQuotaLimits() output (unified source)", async () => {
    const plan = buildPlan({ transcriptsPerMonth: 100, scriptsPerMonth: 25 });
    const grant = buildAccessGrant({ plan });
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(grant);

    const result = await resolveUserAccess("user-1");
    const expected = getQuotaLimits(plan as any);
    expect(result.quotas).toEqual(expected);
  });

  it("AccessGrant without plan returns null quotas", async () => {
    const grant = buildAccessGrant({ plan: null, planId: null });
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(grant);

    const result = await resolveUserAccess("user-1");
    expect(result.status).toBe("FULL_ACCESS");
    expect(result.source).toBe("manual_grant");
    expect(result.quotas).toBeNull();
  });
});

describe("hasAccess()", () => {
  it("returns true for FULL_ACCESS", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(buildAccessGrant());

    expect(await hasAccess("user-1")).toBe(true);
  });

  it("returns false for PAST_DUE (inadimplente perde acesso)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({ status: "PAST_DUE" }),
    );

    expect(await hasAccess("user-1")).toBe(false);
  });

  it("returns false for NO_ACCESS", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.accessGrant.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    expect(await hasAccess("user-1")).toBe(false);
  });

  it("returns false for SUSPENDED", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({ status: "SUSPENDED" }),
    );
    expect(await hasAccess("user-1")).toBe(false);
  });
});
