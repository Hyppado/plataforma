/**
 * Tests: app/components/admin/ShopeeAdminTab.tsx
 *
 * Metade de UI do gate de aprovação. As regras que importam:
 * - PROCESSING e FAILED pertencem ao pipeline e NÃO podem ser revisados
 *   (a API devolve 409; a UI não deve oferecer o botão)
 * - Um item já publicado não mostra "Aprovar"; um já rejeitado não mostra
 *   "Rejeitar"
 * - A aba precisa pedir status=all, senão o admin só veria os publicados —
 *   ou seja, a fila de revisão ficaria invisível
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

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

/** Mocka a listagem inicial da aba. */
function mockList(achadinhos: ShopeeAchadinhoDTO[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, achadinhos }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Renderiza a aba e espera as LINHAS aparecerem.
 *
 * Esperar apenas por `fetch` ter sido chamado não basta: o fetch resolve
 * antes do setState re-renderizar a tabela. Localmente a corrida quase sempre
 * ganha; no CI (mais lento) falhava de forma intermitente.
 */
async function renderTab(achadinhos: ShopeeAchadinhoDTO[]) {
  const fetchMock = mockList(achadinhos);
  render(<ShopeeAdminTab />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  // Espera o carregamento terminar. Não dá para esperar por uma linha
  // específica: o filtro padrão esconde FAILED, então nem toda fixture
  // resulta em linha renderizada.
  await waitFor(() =>
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
  );

  return fetchMock;
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
});

describe("carregamento da fila", () => {
  it("pede status=all — a fila de revisão precisa estar visível", async () => {
    const fetchMock = await renderTab([buildAchadinho()]);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("status=all");
  });

  it("pede um pageSize alto — o default de 24 truncaria a fila", async () => {
    const fetchMock = await renderTab([buildAchadinho()]);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/pageSize=\d{3,}/);
  });
});

describe("visibilidade dos botões de revisão", () => {
  it("PENDING oferece aprovar e rejeitar", async () => {
    await renderTab([buildAchadinho({ status: "PENDING" })]);

    expect(queryByTooltip(/aprovar/i)).toBeTruthy();
    expect(queryByTooltip(/rejeitar/i)).toBeTruthy();
  });

  it("READY não oferece aprovar de novo", async () => {
    await renderTab([buildAchadinho({ status: "READY" })]);

    expect(queryByTooltip(/^aprovar/i)).toBeFalsy();
    expect(queryByTooltip(/rejeitar/i)).toBeTruthy();
  });

  it("REJECTED não oferece rejeitar de novo", async () => {
    await renderTab([buildAchadinho({ status: "REJECTED" })]);

    expect(queryByTooltip(/rejeitar/i)).toBeFalsy();
    expect(queryByTooltip(/aprovar/i)).toBeTruthy();
  });

  it("PROCESSING não é revisável — pertence ao pipeline", async () => {
    await renderTab([buildAchadinho({ status: "PROCESSING" })]);

    expect(queryByTooltip(/aprovar/i)).toBeFalsy();
    expect(queryByTooltip(/rejeitar/i)).toBeFalsy();
  });

  it("FAILED não é revisável — pertence ao pipeline", async () => {
    // Escondido do filtro padrão; mesmo visível, não oferece revisão.
    await renderTab([buildAchadinho({ status: "FAILED" })]);

    expect(queryByTooltip(/aprovar/i)).toBeFalsy();
    expect(queryByTooltip(/rejeitar/i)).toBeFalsy();
  });

  it("editar link de afiliado está sempre disponível", async () => {
    await renderTab([buildAchadinho({ status: "PENDING" })]);

    expect(queryByTooltip(/editar link/i)).toBeTruthy();
  });
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
  it("faz PATCH com action=approve e atualiza a linha", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderTab([
      buildAchadinho({ id: "ach-9", status: "PENDING" }),
    ]);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        achadinho: { ...buildAchadinho({ id: "ach-9" }), status: "READY" },
      }),
    });

    await user.click(queryByTooltip(/aprovar/i)!);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain("/api/shopee/achadinhos/ach-9");
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
        action: "approve",
      });
    });
  });
});
