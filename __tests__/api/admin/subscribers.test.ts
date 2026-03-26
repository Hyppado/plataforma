/**
 * Tests: app/api/admin/subscribers/route.ts
 *
 * Priority: #2 (Admin — subscriber management)
 * Coverage: shape, filtering by status/source, pagination, errors
 *
 * Route now queries local DB (Subscription + User + Plan) instead of Hotmart API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedAdmin } from "@tests/helpers/auth";
import { prismaMock } from "@tests/helpers/prisma-mock";
import { GET } from "@/app/api/admin/subscribers/route";

vi.mock("@/lib/prisma");

/** Helper: create Request with optional query params */
function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/admin/subscribers");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

/** Minimal DB subscription record for mocking */
const mockSub = (overrides: Record<string, unknown> = {}) => ({
  id: "sub-1",
  status: "ACTIVE",
  source: "hotmart",
  startedAt: new Date("2024-01-01"),
  cancelledAt: null,
  createdAt: new Date("2024-01-01"),
  user: { id: "u1", name: "Eve Teste", email: "eve@example.com" },
  plan: {
    id: "plan-1",
    code: "pro_mensal",
    name: "Pro Mensal",
    displayPrice: "R$ 99,90",
    periodicity: "MENSAL",
  },
  hotmart: { subscriberCode: "CODE1", externalStatus: "ACTIVE" },
  charges: [
    {
      paidAt: new Date("2024-02-01"),
      amountCents: 9990,
      currency: "BRL",
    },
  ],
  ...overrides,
});

describe("GET /api/admin/subscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  it("retorna subscriber com shape correto", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([mockSub()]);
    prismaMock.subscription.count.mockResolvedValue(1);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toHaveLength(1);

    const sub = body.subscribers[0];
    expect(sub.id).toBe("sub-1");
    expect(sub.name).toBe("Eve Teste");
    expect(sub.email).toBe("eve@example.com");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.subscriberCode).toBe("CODE1");
    expect(sub.source).toBe("hotmart");
    expect(sub.lastPaymentAmount).toBe(9990);
    expect(sub.lastPaymentCurrency).toBe("BRL");
  });

  it("retorna lista vazia quando DB não tem registros", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("fields opcionais são null quando subscription não tem hotmart/charges", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      mockSub({ hotmart: null, charges: [] }),
    ]);
    prismaMock.subscription.count.mockResolvedValue(1);

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].subscriberCode).toBeNull();
    expect(subscribers[0].lastPaymentAt).toBeNull();
    expect(subscribers[0].lastPaymentAmount).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Filtro por status
  // ---------------------------------------------------------------------------

  it("filtra por status ACTIVE", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "active" }));

    const call = prismaMock.subscription.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ status: "ACTIVE" });
  });

  it("filtra por status CANCELLED", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "canceled" }));

    const call = prismaMock.subscription.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ status: "CANCELLED" });
  });

  it("ignora status inválido (não inclui where.status)", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "nao_existe" }));

    const call = prismaMock.subscription.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("status");
  });

  // ---------------------------------------------------------------------------
  // Filtro por source
  // ---------------------------------------------------------------------------

  it("filtra por source=manual", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    await GET(makeRequest({ source: "manual" }));

    const call = prismaMock.subscription.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ source: "manual" });
  });

  // ---------------------------------------------------------------------------
  // Paginação
  // ---------------------------------------------------------------------------

  it("respeita o parâmetro limit (máx 200)", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.subscription.count.mockResolvedValue(0);

    await GET(makeRequest({ limit: "300" }));

    const call = prismaMock.subscription.findMany.mock.calls[0][0];
    expect(call.take).toBe(200);
  });

  it("inclui paginação na resposta", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([mockSub()]);
    prismaMock.subscription.count.mockResolvedValue(50);

    const { pagination } = await (
      await GET(makeRequest({ page: "1", limit: "10" }))
    ).json();

    expect(pagination.total).toBe(50);
    expect(pagination.totalPages).toBe(5);
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(10);
  });

  // ---------------------------------------------------------------------------
  // Erros
  // ---------------------------------------------------------------------------

  it("retorna 500 quando DB lança erro", async () => {
    prismaMock.subscription.findMany.mockRejectedValue(
      new Error("DB connection lost"),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("DB connection lost");
  });
});
