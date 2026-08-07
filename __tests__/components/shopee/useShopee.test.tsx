/**
 * Tests: lib/swr/useShopee.ts
 *
 * Hooks finos sobre SWR. O que pode dar errado silenciosamente é a montagem
 * da URL — um nome de parâmetro errado faz o filtro simplesmente não aplicar,
 * sem erro visível — e o corpo das mutações de admin.
 *
 * Roda no config de componentes (jsdom) por usar hooks do React.
 */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SWRConfig } from "swr";

import {
  useShopeeRanking,
  useShopeeAchadinhosFeed,
  useShopeeAchadinhos,
  useUpdateAffiliateLink,
  useReviewAchadinho,
} from "@/lib/swr/useShopee";

/** Isola o cache do SWR entre testes. */
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** URL da primeira chamada ao fetch. */
function firstUrl(fetchMock: ReturnType<typeof mockFetch>): string {
  return String(fetchMock.mock.calls[0][0]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useShopeeRanking", () => {
  it("consome GET /api/shopee/ranking", async () => {
    const fetchMock = mockFetch({ ok: true, products: [{ id: "p1" }] });

    const { result } = renderHook(() => useShopeeRanking(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(firstUrl(fetchMock)).toContain("/api/shopee/ranking");
    expect(result.current.products).toHaveLength(1);
  });

  it("devolve lista vazia enquanto carrega, nunca undefined", () => {
    mockFetch({ ok: true, products: [] });

    const { result } = renderHook(() => useShopeeRanking(), { wrapper });

    expect(result.current.products).toEqual([]);
  });
});

describe("useShopeeAchadinhosFeed — montagem da URL", () => {
  it("usa page=1 e pageSize=24 por padrão", async () => {
    const fetchMock = mockFetch({ ok: true, achadinhos: [] });

    renderHook(() => useShopeeAchadinhosFeed({}), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = firstUrl(fetchMock);
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=24");
  });

  it("repassa filtro de categoria", async () => {
    const fetchMock = mockFetch({ ok: true, achadinhos: [] });

    renderHook(() => useShopeeAchadinhosFeed({ category: "Eletrônicos" }), {
      wrapper,
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(decodeURIComponent(firstUrl(fetchMock))).toContain(
      "category=Eletrônicos",
    );
  });

  it("repassa ordenação", async () => {
    const fetchMock = mockFetch({ ok: true, achadinhos: [] });

    renderHook(
      () => useShopeeAchadinhosFeed({ sort: "saleCount", order: "desc" }),
      { wrapper },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = firstUrl(fetchMock);
    expect(url).toContain("sort=saleCount");
    expect(url).toContain("order=desc");
  });

  it("omite filtros vazios em vez de mandar string vazia", async () => {
    // category="" precisa significar "todas", não "categoria vazia"
    const fetchMock = mockFetch({ ok: true, achadinhos: [] });

    renderHook(() => useShopeeAchadinhosFeed({ category: "", search: "" }), {
      wrapper,
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = firstUrl(fetchMock);
    expect(url).not.toContain("category=");
    expect(url).not.toContain("search=");
  });

  it("expõe total, hasMore e categorias da resposta", async () => {
    mockFetch({
      ok: true,
      achadinhos: [{ id: "a1" }],
      total: 42,
      hasMore: true,
      categorias: ["Eletrônicos"],
    });

    const { result } = renderHook(() => useShopeeAchadinhosFeed({}), {
      wrapper,
    });

    await waitFor(() => expect(result.current.total).toBe(42));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.categorias).toEqual(["Eletrônicos"]);
  });
});

describe("useShopeeAchadinhos (admin)", () => {
  it("pede status=all — senão a fila de revisão fica invisível", async () => {
    const fetchMock = mockFetch({ ok: true, achadinhos: [] });

    renderHook(() => useShopeeAchadinhos(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstUrl(fetchMock)).toContain("status=all");
  });
});

describe("useUpdateAffiliateLink", () => {
  it("faz PATCH no id certo com o link novo", async () => {
    const fetchMock = mockFetch({ ok: true, achadinho: {} });

    const { result } = renderHook(() => useUpdateAffiliateLink(), { wrapper });

    await act(async () => {
      await result.current.updateLink({
        id: "ach-7",
        affiliateLink: "https://shope.ee/novo",
      });
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/shopee/achadinhos/ach-7");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      affiliateLink: "https://shope.ee/novo",
    });
  });

  it("propaga a mensagem de erro da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Link do produto inválido" }),
      }),
    );

    const { result } = renderHook(() => useUpdateAffiliateLink(), { wrapper });

    await expect(
      act(async () => {
        await result.current.updateLink({ id: "ach-7", affiliateLink: "nope" });
      }),
    ).rejects.toThrow("Link do produto inválido");
  });
});

describe("useReviewAchadinho", () => {
  it.each(["approve", "reject", "reset"] as const)(
    "envia action=%s",
    async (action) => {
      const fetchMock = mockFetch({ ok: true, achadinho: {} });

      const { result } = renderHook(() => useReviewAchadinho(), { wrapper });

      await act(async () => {
        await result.current.review({ id: "ach-3", action });
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("/api/shopee/achadinhos/ach-3");
      expect((init as RequestInit).method).toBe("PATCH");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        action,
      });
    },
  );

  it("propaga erro de transição inválida (409)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: "Achadinho com status PROCESSING não pode ser revisado",
        }),
      }),
    );

    const { result } = renderHook(() => useReviewAchadinho(), { wrapper });

    await expect(
      act(async () => {
        await result.current.review({ id: "ach-3", action: "approve" });
      }),
    ).rejects.toThrow(/PROCESSING/);
  });
});
