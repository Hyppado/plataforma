/**
 * Tests: app/components/admin/ShopeeAdminTab.tsx
 *
 * Metade de UI do gate de aprovação. As regras que importam:
 * - PROCESSING e FAILED pertencem ao pipeline e NÃO podem ser revisados
 *   (a API devolve 409; a UI não deve oferecer o botão)
 * - Um item já publicado não mostra "Aprovar"; um já rejeitado não mostra
 *   "Rejeitar"
 * - FAILED fica escondido no filtro padrão (é diagnóstico, não fila)
 * - A fila ordena por prioridade de revisão
 *
 * O componente consome os hooks SWR de lib/swr/useShopee, então mockamos os
 * hooks — não o fetch. A montagem da URL (status=all, pageSize) é do hook e
 * está coberta em __tests__/components/shopee/useShopee.test.tsx.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

const review = vi.fn();
const mutate = vi.fn();
let dados: ShopeeAchadinhoDTO[] = [];
let carregando = false;

vi.mock("@/lib/swr/useShopee", () => ({
  useShopeeAchadinhos: () => ({
    achadinhos: dados,
    isLoading: carregando,
    isValidating: false,
    error: null,
    mutate,
  }),
  useReviewAchadinho: () => ({ review, isReviewing: false, error: null }),
  useUpdateAffiliateLink: () => ({ updateLink: vi.fn(), isUpdating: false, error: null }),
}));

import { ShopeeAdminTab } from "@/app/components/admin/ShopeeAdminTab";

function buildAchadinho(
  overrides: Partial<ShopeeAchadinhoDTO> = {},
): ShopeeAchadinhoDTO {
  return {
    id: "ach-1",
    videoExternalId: "7300000000000000000",
    videoUrl: "https://www.tiktok.com/@creator/video/7300000000000000000",
    videoTitle: "achadinho",
    coverUrl: null,
    transcriptText: null,
    productName: "Fone de Ouvido",
    category: "Eletrônicos",
    affiliateLink: "https://shope.ee/abc",
    originalAffLink: null,
    price: 49.9,
    saleCount: 10,
    views: 100000,
    commission: 8.5,
    authorName: "creator",
    status: "PENDING",
    errorMessage: null,
    productImageUrl: null,
    productPriceMin: null,
    productPriceMax: null,
    productLink: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  } as ShopeeAchadinhoDTO;
}

/** Define os dados devolvidos pelo hook e renderiza a aba. */
async function renderTab(achadinhos: ShopeeAchadinhoDTO[]) {
  dados = achadinhos;
  carregando = false;
  render(<ShopeeAdminTab />);
  // Sem spinner: o hook já devolve os dados na primeira renderização
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
}

/**
 * Busca um controle pelo texto acessível do tooltip.
 *
 * O MUI envolve IconButtons que podem ficar disabled num <span>, e é nesse
 * span que o aria-label do Tooltip acaba. Para clicar é preciso descer até o
 * <button> de verdade — clicar no span não dispara o onClick.
 */
function queryByTooltip(name: RegExp): HTMLElement | null {
  const el = screen.queryByLabelText(name) ?? screen.queryByTitle(name);
  if (!el) return null;
  if (el.tagName === "BUTTON") return el as HTMLElement;
  return (el.querySelector("button") as HTMLElement | null) ?? el;
}

beforeEach(() => {
  vi.clearAllMocks();
  dados = [];
  carregando = false;
  review.mockResolvedValue({ ok: true, achadinho: { status: "READY" } });
});

describe("filtro padrão", () => {
  it("esconde FAILED por padrão — falhas são diagnóstico, não fila", async () => {
    await renderTab([
      buildAchadinho({ id: "a", status: "PENDING", productName: "Para Revisar" }),
      buildAchadinho({ id: "b", status: "FAILED", productName: "Deu Errado" }),
    ]);

    expect(screen.getByText("Para Revisar")).toBeInTheDocument();
    expect(screen.queryByText("Deu Errado")).not.toBeInTheDocument();
  });

  it("conta apenas os visíveis no cabeçalho", async () => {
    await renderTab([
      buildAchadinho({ id: "a", status: "PENDING", productName: "Para Revisar" }),
      buildAchadinho({ id: "b", status: "FAILED", productName: "Deu Errado" }),
      buildAchadinho({ id: "c", status: "FAILED", productName: "Outro Erro" }),
    ]);

    expect(screen.getByText(/1 achadinhos encontrados/)).toBeInTheDocument();
  });
});

describe("ordenação da fila", () => {
  it("mostra PENDING antes de PUBLICADO — o que exige ação vem primeiro", async () => {
    // Regressão real: 22 publicados enterravam o único item a revisar.
    await renderTab([
      buildAchadinho({ id: "a", status: "READY", productName: "Publicado A" }),
      buildAchadinho({ id: "b", status: "READY", productName: "Publicado B" }),
      buildAchadinho({ id: "c", status: "PENDING", productName: "Precisa Revisar" }),
    ]);

    const linhas = screen.getAllByRole("row").slice(1); // pula o cabeçalho
    expect(linhas[0]).toHaveTextContent("Precisa Revisar");
  });

  it("REJECTED vai para o fim da fila", async () => {
    await renderTab([
      buildAchadinho({ id: "a", status: "REJECTED", productName: "Item Arquivado" }),
      buildAchadinho({ id: "b", status: "PENDING", productName: "Item Na Fila" }),
    ]);

    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas[0]).toHaveTextContent("Item Na Fila");
    expect(linhas[linhas.length - 1]).toHaveTextContent("Item Arquivado");
  });
});

describe("player de revisão", () => {
  it("oferece assistir ao vídeo em cada linha", async () => {
    // O admin precisa ver o vídeo antes de publicar — aprovar às cegas um
    // par vídeo/produto montado por IA é exatamente o que o gate evita.
    await renderTab([buildAchadinho()]);

    expect(queryByTooltip(/assistir ao vídeo/i)).toBeTruthy();
  });

  it("desabilita quando o registro não tem vídeo", async () => {
    await renderTab([
      buildAchadinho({ videoUrl: null } as Partial<ShopeeAchadinhoDTO>),
    ]);

    const btn = queryByTooltip(/sem vídeo/i);
    expect(btn).toBeTruthy();
    expect(btn).toBeDisabled();
  });

  it("abre o player com a URL do TikTok ao clicar", async () => {
    const user = userEvent.setup();
    await renderTab([buildAchadinho()]);

    await user.click(queryByTooltip(/assistir ao vídeo/i)!);

    await waitFor(() => {
      expect(
        document.querySelector('iframe[src*="tiktok.com/embed"]'),
      ).toBeTruthy();
    });
  });
});

describe("ação de aprovar", () => {
  it("chama o hook de revisão com approve e o id certo", async () => {
    const user = userEvent.setup();
    await renderTab([buildAchadinho({ id: "ach-9", status: "PENDING" })]);

    await user.click(queryByTooltip(/aprovar/i)!);

    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({ id: "ach-9", action: "approve" }),
    );
  });

  it("chama o hook com reject", async () => {
    const user = userEvent.setup();
    await renderTab([buildAchadinho({ id: "ach-7", status: "PENDING" })]);

    await user.click(queryByTooltip(/rejeitar/i)!);

    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({ id: "ach-7", action: "reject" }),
    );
  });
});
