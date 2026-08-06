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

/** Espera a tabela terminar de carregar. */
async function renderTab(achadinhos: ShopeeAchadinhoDTO[]) {
  const fetchMock = mockList(achadinhos);
  render(<ShopeeAdminTab />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
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
    await renderTab([buildAchadinho({ status: "FAILED" })]);

    expect(queryByTooltip(/aprovar/i)).toBeFalsy();
    expect(queryByTooltip(/rejeitar/i)).toBeFalsy();
  });

  it("editar link de afiliado está sempre disponível", async () => {
    await renderTab([buildAchadinho({ status: "FAILED" })]);

    expect(queryByTooltip(/editar link/i)).toBeTruthy();
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
