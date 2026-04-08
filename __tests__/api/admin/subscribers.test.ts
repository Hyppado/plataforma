/**
 * Tests: app/api/admin/subscribers/route.ts
 *
 * Priority: #2 (Admin — subscriber management)
 * Coverage: shape, filtering by status, search, pagination, errors
 *
 * Route now fetches subscribers from Hotmart API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedAdmin } from "@tests/helpers/auth";
import { GET } from "@/app/api/admin/subscribers/route";

vi.mock("@/lib/hotmart/client");
vi.mock("@/lib/settings");

import { hotmartRequest } from "@/lib/hotmart/client";
import { getSetting } from "@/lib/settings";

const mockHotmartRequest = vi.mocked(hotmartRequest);
const mockGetSetting = vi.mocked(getSetting);

/** Helper: create Request with optional query params */
function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/admin/subscribers");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

/** Minimal Hotmart subscription item for mocking */
const mockHotmartItem = (overrides: Record<string, unknown> = {}) => ({
  subscriber_code: "CODE1",
  subscription_id: 12345,
  status: "ACTIVE",
  accession_date: new Date("2024-01-01").getTime(),
  end_date: undefined,
  plan: { name: "Pro Mensal", id: 100, recurrency_period: "MONTHLY" },
  price: { value: 99.9, currency_code: "BRL" },
  subscriber: { name: "Eve Teste", email: "eve@example.com", ucode: "u1" },
  ...overrides,
});

/** Standard successful Hotmart API response */
const mockResponse = (
  items: ReturnType<typeof mockHotmartItem>[] = [mockHotmartItem()],
  totalResults?: number,
) => ({
  items,
  page_info: {
    total_results: totalResults ?? items.length,
    results_per_page: 50,
  },
});

describe("GET /api/admin/subscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    mockGetSetting.mockResolvedValue("PROD123");
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  it("retorna subscriber com shape correto vindo da Hotmart API", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse());

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toHaveLength(1);

    const sub = body.subscribers[0];
    expect(sub.id).toBe("12345");
    expect(sub.name).toBe("Eve Teste");
    expect(sub.email).toBe("eve@example.com");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.subscriberCode).toBe("CODE1");
    expect(sub.source).toBe("hotmart");
    expect(sub.hotmartStatus).toBe("ACTIVE");
    expect(sub.lastPaymentAmount).toBe(9990);
    expect(sub.lastPaymentCurrency).toBe("BRL");
    expect(sub.plan.name).toBe("Pro Mensal");
  });

  it("retorna lista vazia quando Hotmart não tem registros", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("mapeia campos opcionais como null quando ausentes", async () => {
    mockHotmartRequest.mockResolvedValue(
      mockResponse([
        mockHotmartItem({
          subscriber: { name: null, email: null, ucode: "u1" },
          end_date: undefined,
          price: undefined,
        }),
      ]),
    );

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].name).toBeNull();
    expect(subscribers[0].cancelledAt).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Status mapping
  // ---------------------------------------------------------------------------

  it("mapeia CANCELLED_BY_CUSTOMER para CANCELED", async () => {
    mockHotmartRequest.mockResolvedValue(
      mockResponse([mockHotmartItem({ status: "CANCELLED_BY_CUSTOMER" })]),
    );

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].status).toBe("CANCELED");
    expect(subscribers[0].hotmartStatus).toBe("CANCELLED_BY_CUSTOMER");
  });

  it("mapeia DELAYED para PAST_DUE", async () => {
    mockHotmartRequest.mockResolvedValue(
      mockResponse([mockHotmartItem({ status: "DELAYED" })]),
    );

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].status).toBe("PAST_DUE");
  });

  // ---------------------------------------------------------------------------
  // Filtro por status
  // ---------------------------------------------------------------------------

  it("envia status ACTIVE para Hotmart quando filtro=active", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest({ status: "active" }));

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("envia status CANCELLED_BY_CUSTOMER para Hotmart quando filtro=canceled", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest({ status: "canceled" }));

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({
          status: "CANCELLED_BY_CUSTOMER",
        }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Busca por email
  // ---------------------------------------------------------------------------

  it("envia subscriber_email quando search contém @", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest({ search: "eve@example.com" }));

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({
          subscriber_email: "eve@example.com",
        }),
      }),
    );
  });

  it("filtra client-side por nome quando search não contém @", async () => {
    mockHotmartRequest.mockResolvedValue(
      mockResponse([
        mockHotmartItem({
          subscriber: { name: "Eve Teste", email: "eve@test.com", ucode: "u1" },
        }),
        mockHotmartItem({
          subscriber: {
            name: "João Silva",
            email: "joao@test.com",
            ucode: "u2",
          },
          subscription_id: 999,
        }),
      ]),
    );

    const { subscribers } = await (
      await GET(makeRequest({ search: "eve" }))
    ).json();

    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].name).toBe("Eve Teste");
  });

  // ---------------------------------------------------------------------------
  // Product ID
  // ---------------------------------------------------------------------------

  it("envia product_id do Setting na requisição", async () => {
    mockGetSetting.mockResolvedValue("MY_PRODUCT_123");
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest());

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ product_id: "MY_PRODUCT_123" }),
      }),
    );
  });

  it("não envia product_id quando Setting retorna null", async () => {
    mockGetSetting.mockResolvedValue(null);
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest());

    const call = mockHotmartRequest.mock.calls[0];
    const params = call[1]?.params as Record<string, unknown>;
    expect(params).not.toHaveProperty("product_id");
  });

  // ---------------------------------------------------------------------------
  // Paginação
  // ---------------------------------------------------------------------------

  it("respeita o parâmetro limit (máx 200)", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([]));

    await GET(makeRequest({ limit: "300" }));

    expect(mockHotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ max_results: 200 }),
      }),
    );
  });

  it("inclui paginação na resposta", async () => {
    mockHotmartRequest.mockResolvedValue(mockResponse([mockHotmartItem()], 50));

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

  it("retorna 500 quando Hotmart API lança erro", async () => {
    mockHotmartRequest.mockRejectedValue(new Error("Hotmart API unreachable"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("Hotmart API unreachable");
  });
});
