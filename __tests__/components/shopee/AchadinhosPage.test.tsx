/**
 * Tests: app/dashboard/shopee/achadinhos/page.tsx
 *
 * O que importa aqui é a ordenação PADRÃO — a que vale quando o usuário abre
 * a página sem nenhum parâmetro na URL. Ela já foi "Mais Vendidos" e passou a
 * ser "Recentes"; é uma linha fácil de reverter sem querer num merge, e o
 * sintoma (feed abrindo na ordem errada) não quebra nada, então passaria
 * despercebido.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const useShopeeAchadinhosFeed = vi.fn();
vi.mock("@/lib/swr/useShopee", () => ({
  useShopeeAchadinhosFeed: (...a: unknown[]) => useShopeeAchadinhosFeed(...a),
}));

vi.mock("@/app/components/dashboard/DashboardHeader", () => ({
  DashboardHeader: () => <div />,
}));

vi.mock("@/app/components/shopee/ShopeeAchadinhoCard", () => ({
  ShopeeAchadinhoCard: () => <div />,
}));

import AchadinhosPage from "@/app/dashboard/shopee/achadinhos/page";

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Array.from(searchParams.keys())) searchParams.delete(k);
  useShopeeAchadinhosFeed.mockReturnValue({
    achadinhos: [],
    total: 0,
    hasMore: false,
    categorias: [],
    isLoading: false,
    isValidating: false,
    error: null,
    mutate: vi.fn(),
  });
});

/** Argumentos da última chamada ao hook do feed. */
function feedArgs() {
  const call = useShopeeAchadinhosFeed.mock.calls.at(-1);
  return (call?.[0] ?? {}) as { sort?: string; order?: string };
}

describe("ordenação padrão", () => {
  it("abre em Recentes, decrescente", async () => {
    render(<AchadinhosPage />);

    await waitFor(() => expect(useShopeeAchadinhosFeed).toHaveBeenCalled());
    expect(feedArgs().sort).toBe("createdAt");
    expect(feedArgs().order).toBe("desc");
  });

  it("a URL continua sobrescrevendo o padrão", async () => {
    // O padrão não pode virar um valor fixo: os chips de ordenação escrevem
    // na query string e precisam continuar valendo.
    searchParams.set("sort", "saleCount");
    searchParams.set("order", "asc");

    render(<AchadinhosPage />);

    await waitFor(() => expect(useShopeeAchadinhosFeed).toHaveBeenCalled());
    expect(feedArgs().sort).toBe("saleCount");
    expect(feedArgs().order).toBe("asc");
  });
});
