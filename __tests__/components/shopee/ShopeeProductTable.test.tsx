/**
 * Tests: app/components/shopee/ShopeeProductTable.tsx
 *
 * O modo lista do Ranking Shopee era um stub que só dizia "Modo lista
 * disponível apenas para produtos TikTok" — o botão alternava a view e nada
 * aparecia. Estes testes cobrem a tabela que substituiu o stub.
 *
 * O preço da Shopee já vem em BRL: diferente da ProductTable do TikTok, aqui
 * NÃO existe conversão de câmbio. Um teste fixa isso, porque reintroduzir a
 * conversão passaria despercebido num valor plausível.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { ShopeeProductTable } from "@/app/components/shopee/ShopeeProductTable";
import type { ShopeeProductTrendDTO } from "@/lib/swr/useShopee";

function makeProduct(
  overrides: Partial<ShopeeProductTrendDTO> = {},
): ShopeeProductTrendDTO {
  return {
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
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("conteúdo", () => {
  it("mostra os dados do produto na linha", () => {
    render(<ShopeeProductTable products={[makeProduct()]} title="Ranking Shopee" />);

    expect(screen.getByText("Cesto de roupas dobrável")).toBeInTheDocument();
    expect(screen.getByText("Loja Oficial")).toBeInTheDocument();
    expect(screen.getByText("33,6K")).toBeInTheDocument();
    expect(screen.getByText("13,0%")).toBeInTheDocument();
  });

  it("formata preço em BRL sem converter câmbio", () => {
    // 49,90 é o valor da Shopee. Se alguém aplicar a cotação USD→BRL da
    // ProductTable do TikTok aqui, viraria ~R$ 270 e ninguém notaria.
    render(<ShopeeProductTable products={[makeProduct()]} title="Ranking" />);

    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
  });

  it("usa a posição do ranking vinda da Shopee", () => {
    render(
      <ShopeeProductTable products={[makeProduct({ rankPosition: 7 })]} title="R" />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("degrada campos ausentes para travessão", () => {
    render(
      <ShopeeProductTable
        products={[
          makeProduct({
            price: 0,
            saleCount: 0,
            commissionRate: 0,
            shopName: null,
            categoryName: null,
          }),
        ]}
        title="R"
      />,
    );

    // Preço, vendas, comissão e loja — a receita (gmv) continua preenchida
    // e o link existe, então são exatamente 4.
    expect(screen.getAllByText("—")).toHaveLength(4);
  });
});

describe("estados", () => {
  it("mostra esqueleto enquanto carrega", () => {
    const { container } = render(
      <ShopeeProductTable products={[]} loading title="R" />,
    );

    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nenhum produto encontrado.")).not.toBeInTheDocument();
  });

  it("mostra vazio quando não há produtos", () => {
    render(<ShopeeProductTable products={[]} title="R" />);

    expect(screen.getByText("Nenhum produto encontrado.")).toBeInTheDocument();
  });
});

describe("interações", () => {
  it("abre os detalhes ao clicar na linha", () => {
    const onProductClick = vi.fn();
    render(
      <ShopeeProductTable
        products={[makeProduct()]}
        title="R"
        onProductClick={onProductClick}
      />,
    );

    fireEvent.click(screen.getByText("Cesto de roupas dobrável"));

    expect(onProductClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
    );
  });

  it("o botão de criar vídeo não abre os detalhes junto", () => {
    // A linha inteira é clicável; sem stopPropagation o clique na ação
    // dispararia a modal ao mesmo tempo que a navegação.
    const onProductClick = vi.fn();
    render(
      <ShopeeProductTable
        products={[makeProduct()]}
        title="R"
        onProductClick={onProductClick}
      />,
    );

    fireEvent.click(screen.getByLabelText("Criar vídeo com avatar"));

    expect(onProductClick).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("shopeeProductId=ext-1"),
    );
  });

  it("não oferece link da Shopee quando o produto não tem", () => {
    render(
      <ShopeeProductTable
        products={[makeProduct({ affiliateLink: null })]}
        title="R"
      />,
    );

    expect(screen.queryByLabelText("Ver na Shopee")).not.toBeInTheDocument();
  });
});
