/**
 * Tests: app/api/user/subscription/route.ts — SECURITY VULNERABILITY TEST
 *
 * Priority: #0 (CRITICAL SECURITY — NO AUTH on this endpoint!)
 *
 * This endpoint has NO AUTHENTICATION. It accepts userId or email as query
 * params and returns subscription details, billing history, plan quotas,
 * and Hotmart subscriber codes to ANYONE.
 *
 * These tests document and expose this vulnerability.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { NextRequest } from "next/server";
import {
  buildUser,
  buildSubscription,
  buildPlan,
} from "@tests/helpers/factories";

vi.mock("@/lib/prisma");

import { GET } from "@/app/api/user/subscription/route";

/** Helper: make NextRequest for this route (no auth — route has NO auth!) */
function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/user/subscription");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/user/subscription — SECURITY", () => {
  beforeEach(() => vi.clearAllMocks());

  it("⚠️ SECURITY: endpoint has NO authentication", async () => {
    const user = buildUser({ id: "victim-id" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([]);

    const req = makeReq({ userId: "victim-id" });
    const res = await GET(req);

    // This SHOULD be 401, but ISN'T — proving the vulnerability
    expect(res.status).toBe(200);
  });

  it("⚠️ SECURITY: leaks user email in response", async () => {
    const user = buildUser({ id: "victim-id", email: "victim@real.com" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([]);

    const req = makeReq({ email: "victim@real.com" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.member.email).toBe("victim@real.com");
  });

  it("⚠️ SECURITY: leaks subscriberCode without auth", async () => {
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([
      {
        provider: "hotmart",
        externalCustomerId: "SECRET_SUB_CODE",
        externalReference: "SECRET_SUB_CODE",
        linkedAt: new Date(),
      },
    ]);

    const req = makeReq({ userId: "u1" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.hotmartIntegration.subscriberCode).toBe("SECRET_SUB_CODE");
  });
});

describe("GET /api/user/subscription — Functional", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when neither userId nor email provided", async () => {
    const req = makeReq();
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = makeReq({ userId: "nonexistent" });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns subscription details with plan info", async () => {
    const plan = buildPlan({
      name: "Pro Mensal",
      code: "pro_mensal",
      periodicity: "MENSAL",
      displayPrice: "R$ 99,90",
      transcriptsPerMonth: 100,
    });
    const user = buildUser({ id: "u1" });
    const sub = buildSubscription({
      userId: "u1",
      status: "ACTIVE",
      plan,
      hotmart: null,
      charges: [],
    });

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.subscription.findFirst.mockResolvedValue(sub);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([]);

    const req = makeReq({ userId: "u1" });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscription.planName).toBe("Pro Mensal");
    expect(body.subscription.status).toBe("Ativa");
  });

  it("returns null subscription when user has none", async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser({ id: "u1" }));
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([]);

    const req = makeReq({ userId: "u1" });
    const res = await GET(req);
    const body = await res.json();

    expect(body.subscription).toBeNull();
  });

  it("maps subscription statuses correctly", async () => {
    const user = buildUser({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.externalAccountLink.findMany.mockResolvedValue([]);

    prismaMock.subscription.findFirst.mockResolvedValue(
      buildSubscription({
        status: "CANCELLED",
        plan: buildPlan({ periodicity: "MENSAL" }),
        charges: [],
        hotmart: null,
      }),
    );

    const req = makeReq({ userId: "u1" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.subscription.status).toBe("Cancelada");
  });
});
