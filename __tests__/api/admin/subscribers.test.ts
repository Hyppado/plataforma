import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthenticatedAdmin } from "@tests/helpers/auth";
import { GET } from "@/app/api/admin/subscribers/route";
import { hotmartRequest } from "@/lib/hotmart/client";

vi.mock("@/lib/hotmart/client", () => ({
  hotmartRequest: vi.fn(),
}));

/** Cria um Request para a rota de assinantes com query params opcionais. */
function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/admin/subscribers");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

/** Item mínimo válido da API Hotmart para testes. */
const mockItem = (overrides: Record<string, unknown> = {}) => ({
  subscriber_code: "CODE1",
  subscription_id: 42,
  status: "ACTIVE",
  accession_date: 1_700_000_000_000,
  plan: { name: "Mensal", id: 99, recurrency_period: 30 },
  product: { name: "Produto Teste", id: 7420891 },
  price: { currency_code: "BRL", value: 99.9 },
  subscriber: { name: "Eve Teste", email: "eve@example.com", ucode: "u1" },
  ...overrides,
});

describe("GET /api/admin/subscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedAdmin();
    process.env.HOTMART_PRODUCT_ID = "7420891";
  });

  // ---------------------------------------------------------------------------
  // Formato da resposta
  // ---------------------------------------------------------------------------

  it("retorna subscriber com shape correto", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [mockItem()],
      page_info: { results_per_page: 10, total_results: 1 },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toHaveLength(1);

    const sub = body.subscribers[0];
    expect(sub.id).toBe("42");
    expect(sub.name).toBe("Eve Teste");
    expect(sub.email).toBe("eve@example.com");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.subscriberCode).toBe("CODE1");
    expect(sub.startedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(sub.lastPaymentAmount).toBe(9990);
    expect(sub.lastPaymentCurrency).toBe("BRL");
  });

  it("formata displayPrice com 2 casas decimais", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [mockItem({ price: { currency_code: "BRL", value: 99.9 } })],
    });

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].plan.displayPrice).toBe("BRL 99.90");
  });

  it("retorna lista vazia quando API não retorna items", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [],
      page_info: { total_results: 0 },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("trata resposta sem campo items sem lançar erro", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ page_info: {} });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscribers).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Periodicidade do plano
  // ---------------------------------------------------------------------------

  it("define periodicidade MONTHLY para ciclo < 360 dias", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [
        mockItem({ plan: { name: "Mensal", id: 1, recurrency_period: 30 } }),
      ],
    });

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].plan.periodicity).toBe("MONTHLY");
  });

  it("define periodicidade ANNUAL para ciclo >= 360 dias", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [
        mockItem({ plan: { name: "Anual", id: 2, recurrency_period: 365 } }),
      ],
    });

    const { subscribers } = await (await GET(makeRequest())).json();
    expect(subscribers[0].plan.periodicity).toBe("ANNUAL");
  });

  // ---------------------------------------------------------------------------
  // Filtro por status
  // ---------------------------------------------------------------------------

  it("passa status ACTIVE para a API quando filtrado por 'active'", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ status: "active" }));

    expect(hotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("mapeia 'canceled' para CANCELLED_BY_CUSTOMER", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ status: "canceled" }));

    expect(hotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ status: "CANCELLED_BY_CUSTOMER" }),
      }),
    );
  });

  it("mapeia 'past_due' para OVERDUE", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ status: "past_due" }));

    expect(hotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ status: "OVERDUE" }),
      }),
    );
  });

  it("não inclui status nos params quando nenhum filtro é passado", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest());

    const callParams = vi.mocked(hotmartRequest).mock.calls.at(-1)![1]!.params!;
    expect(callParams).not.toHaveProperty("status");
  });

  it("ignora status inválido (não inclui nos params)", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ status: "nao_existe" }));

    const callParams = vi.mocked(hotmartRequest).mock.calls.at(-1)![1]!.params!;
    expect(callParams).not.toHaveProperty("status");
  });

  // ---------------------------------------------------------------------------
  // Filtro de busca local (search)
  // ---------------------------------------------------------------------------

  it("filtra resultados localmente por nome (case-insensitive)", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [
        mockItem({
          subscription_id: 1,
          subscriber: { name: "Alice Silva", email: "alice@test.com" },
        }),
        mockItem({
          subscription_id: 2,
          subscriber: { name: "Bob Santos", email: "bob@test.com" },
        }),
      ],
    });

    const { subscribers } = await (
      await GET(makeRequest({ search: "alice" }))
    ).json();

    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].name).toBe("Alice Silva");
  });

  it("filtra resultados localmente por email", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [
        mockItem({
          subscription_id: 1,
          subscriber: { name: "Alice", email: "alice@test.com" },
        }),
        mockItem({
          subscription_id: 2,
          subscriber: { name: "Bob", email: "bob@test.com" },
        }),
      ],
    });

    const { subscribers } = await (
      await GET(makeRequest({ search: "bob@" }))
    ).json();

    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].email).toBe("bob@test.com");
  });

  it("retorna todos os resultados quando search não bate com nenhum", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [
        mockItem({
          subscription_id: 1,
          subscriber: { name: "Alice", email: "alice@test.com" },
        }),
      ],
    });

    const { subscribers } = await (
      await GET(makeRequest({ search: "xyz123" }))
    ).json();

    expect(subscribers).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Paginação
  // ---------------------------------------------------------------------------

  it("passa page_token para a API", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ page_token: "tok_abc" }));

    expect(hotmartRequest).toHaveBeenCalledWith(
      "/payments/api/v1/subscriptions",
      expect.objectContaining({
        params: expect.objectContaining({ page_token: "tok_abc" }),
      }),
    );
  });

  it("expõe next_page_token no campo pagination", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({
      items: [],
      page_info: { next_page_token: "tok_next" },
    });

    const { pagination } = await (await GET(makeRequest())).json();

    expect(pagination.nextPageToken).toBe("tok_next");
  });

  it("retorna nextPageToken null quando não há próxima página", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [], page_info: {} });

    const { pagination } = await (await GET(makeRequest())).json();

    expect(pagination.nextPageToken).toBeNull();
  });

  it("respeita o parâmetro limit (máx 200)", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue({ items: [] });

    await GET(makeRequest({ limit: "300" }));

    const callParams = vi.mocked(hotmartRequest).mock.calls.at(-1)![1]!.params!;
    expect(callParams.max_results).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Erros
  // ---------------------------------------------------------------------------

  it("retorna 400 quando HOTMART_PRODUCT_ID não está configurado", async () => {
    delete process.env.HOTMART_PRODUCT_ID;

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/HOTMART_PRODUCT_ID/);
  });

  it("retorna 500 quando hotmartRequest lança erro", async () => {
    vi.mocked(hotmartRequest).mockRejectedValue(
      new Error("Hotmart unavailable"),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("Hotmart unavailable");
  });
});
