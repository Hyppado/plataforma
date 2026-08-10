/**
 * Tests: app/dashboard/shopee/ranking/page.tsx — alternância card/lista.
 *
 * O REGRESSO QUE ESTE TESTE EXISTE PARA PEGAR
 * O modo lista era um stub: o botão alternava a view e a página exibia
 * "Modo lista disponível apenas para produtos TikTok" no lugar dos produtos.
 * Nada quebrava — nem typecheck, nem build, nem teste — porque era um texto
 * válido. Só dava para perceber usando a tela.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

let viewMode: "card" | "list" = "list";
vi.mock("@/lib/useViewMode", () => ({
  useViewMode: () => [viewMode, vi.fn()],
}));

const useShopeeRanking = vi.fn();
vi.mock("@/lib/swr/useShopee", () => ({
  useShopeeRanking: () => useShopeeRanking(),
}));

vi.mock("@/app/components/shopee/ShopeeCategoryDropdown", () => ({
  ShopeeCategoryDropdown: () => <div />,
}));

vi.mock("@/app/components/shopee/ShopeeProductCard", () => ({
  ShopeeProductCard: ({ product }: { product: { productName: string } }) => (
    <div data-testid="card">{product.productName}</div>
  ),
}));

import RankingPage from "@/app/dashboard/shopee/ranking/page";

const PRODUTO = {
  id: "p1",
  productExternalId: "ext-1",
  productName: "Cesto de roupas dobrável",
  coverUrl: "https://cdn/img.jpg",
  price: 49.9,
  commissionRate: 0.13,
  saleCount: 33600,
  gmv: 1676000,
  rating: 4.8,
  shopName: "Loja Oficial",
  affiliateLink: "https://shopee.com.br/product/1",
  rankPosition: 1,
  syncedAt: "2026-08-10T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  viewMode = "list";
  useShopeeRanking.mockReturnValue({
    products: [PRODUTO],
    isLoading: false,
    error: null,
  });
});

describe("modo lista", () => {
  it("renderiza a tabela de produtos, não a mensagem de indisponível", () => {
    render(<RankingPage />);

    expect(
      screen.queryByText(/Modo lista disponível apenas para produtos TikTok/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Cesto de roupas dobrável")).toBeInTheDocument();
  });

  it("não usa os cards quando está em lista", () => {
    render(<RankingPage />);

    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });
});

describe("modo card", () => {
  it("continua renderizando os cards", () => {
    viewMode = "card";

    render(<RankingPage />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
