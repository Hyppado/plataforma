import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/admin/subscription-metrics/route";
import { hotmartRequest } from "@/lib/hotmart/client";
import { getSettingOrEnv } from "@/lib/settings";

vi.mock("@/lib/hotmart/client", () => ({
  hotmartRequest: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSettingOrEnv: vi.fn(),
  SETTING_KEYS: {
    HOTMART_PRODUCT_ID: "hotmart.product_id",
    HOTMART_WEBHOOK_URL: "hotmart.webhook_url",
    APP_NAME: "app.name",
  },
}));

/** Resposta simulada da API Hotmart com N itens. */
const apiResponse = (count: number) => ({
  items: Array.from({ length: count }, (_, i) => ({ id: i })),
  page_info: { total_results: count },
});

describe("GET /api/admin/subscription-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSettingOrEnv).mockResolvedValue("7420891");
  });

  // ---------------------------------------------------------------------------
  // Contagem de métricas
  // ---------------------------------------------------------------------------

  it("retorna contagens corretas para cada status", async () => {
    // As 5 chamadas paralelas são feitas na ordem:
    // ACTIVE → CANCELLED_BY_CUSTOMER → OVERDUE → INACTIVE → (sem status = total)
    vi.mocked(hotmartRequest)
      .mockResolvedValueOnce(apiResponse(5)) // ACTIVE
      .mockResolvedValueOnce(apiResponse(2)) // CANCELLED_BY_CUSTOMER
      .mockResolvedValueOnce(apiResponse(1)) // OVERDUE
      .mockResolvedValueOnce(apiResponse(3)) // INACTIVE
      .mockResolvedValueOnce(apiResponse(11)); // total

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activeSubscribers).toBe(5);
    expect(body.canceledSubscribers).toBe(2);
    expect(body.totalSubscribers).toBe(11);
  });

  it("soma OVERDUE + INACTIVE em pastDueSubscribers", async () => {
    vi.mocked(hotmartRequest)
      .mockResolvedValueOnce(apiResponse(0)) // ACTIVE
      .mockResolvedValueOnce(apiResponse(0)) // CANCELLED_BY_CUSTOMER
      .mockResolvedValueOnce(apiResponse(3)) // OVERDUE
      .mockResolvedValueOnce(apiResponse(2)) // INACTIVE
      .mockResolvedValueOnce(apiResponse(5)); // total

    const res = await GET();
    const { pastDueSubscribers } = await res.json();

    expect(pastDueSubscribers).toBe(5); // 3 OVERDUE + 2 INACTIVE
  });

  it("faz exatamente 5 chamadas à API Hotmart", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue(apiResponse(0));

    await GET();

    expect(hotmartRequest).toHaveBeenCalledTimes(5);
  });

  it("busca por ACTIVE, CANCELLED_BY_CUSTOMER, OVERDUE, INACTIVE e sem status", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue(apiResponse(0));

    await GET();

    const statuses = vi
      .mocked(hotmartRequest)
      .mock.calls.map(
        (c) => (c[1] as { params?: { status?: string } })?.params?.status,
      );

    expect(statuses).toContain("ACTIVE");
    expect(statuses).toContain("CANCELLED_BY_CUSTOMER");
    expect(statuses).toContain("OVERDUE");
    expect(statuses).toContain("INACTIVE");
    expect(statuses).toContain(undefined); // chamada sem status = total
  });

  // ---------------------------------------------------------------------------
  // Campos estáticos e de período
  // ---------------------------------------------------------------------------

  it("retorna campos estáticos com valores padrão", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue(apiResponse(0));

    const {
      newThisMonth,
      cancelledThisMonth,
      revenueThisMonthCents,
      lastSyncAt,
    } = await (await GET()).json();

    expect(newThisMonth).toBe(0);
    expect(cancelledThisMonth).toBe(0);
    expect(revenueThisMonthCents).toBe(0);
    expect(lastSyncAt).toBeNull();
  });

  it("retorna periodLabel com mês e ano atuais em português", async () => {
    vi.mocked(hotmartRequest).mockResolvedValue(apiResponse(0));

    const { periodLabel } = await (await GET()).json();
    const now = new Date();
    const year = now.getFullYear().toString();

    expect(periodLabel).toMatch(year);
    // Verifica que é uma string não vazia com formato "Mês Ano"
    expect(periodLabel).toMatch(/^[A-Za-zÀ-ú]+ \d{4}$/);
  });

  // ---------------------------------------------------------------------------
  // Erros
  // ---------------------------------------------------------------------------

  it("retorna 400 quando HOTMART_PRODUCT_ID não está configurado", async () => {
    vi.mocked(getSettingOrEnv).mockResolvedValue("");

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/HOTMART_PRODUCT_ID/);
  });

  it("retorna 500 quando hotmartRequest lança erro", async () => {
    vi.mocked(hotmartRequest).mockRejectedValue(new Error("API timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(body.detail).toContain("API timeout");
  });

  it("retorna 500 mesmo quando apenas uma das chamadas falha", async () => {
    vi.mocked(hotmartRequest)
      .mockResolvedValueOnce(apiResponse(3)) // ACTIVE ok
      .mockRejectedValueOnce(new Error("partial failure")); // CANCELLED falha

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
