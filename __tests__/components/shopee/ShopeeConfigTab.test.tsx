/**
 * Tests: app/components/admin/shopee/ShopeeConfigTab.tsx
 *
 * REGRESSÃO QUE ESTES TESTES EXISTEM PARA PEGAR
 * Os dois useEffect do seletor de hashtag foram parar DENTRO do
 * `if (loading) { ... }`. Na primeira renderização (loading=true) os hooks
 * rodavam; quando o config carregava (loading=false) eles sumiam, e o React
 * derrubava a tela com "Rendered fewer hooks than expected".
 *
 * Typecheck, build e 1202 testes passaram — nenhum renderizava este
 * componente. Só quebrava em produção, ao abrir a aba.
 *
 * Por isso o teste central abaixo atravessa a transição loading -> carregado.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ShopeeConfigTab } from "@/app/components/admin/shopee/ShopeeConfigTab";

const CONFIG = {
  configured: true,
  rankingLimit: "50",
  rankingFrequency: "24",
  achadinhosFrequency: "12",
  achadinhosCount: "50",
  achadinhosHashtagId: "1696392324325382,1697332031215622",
};

const HASHTAGS = [
  { id: "1696392324325382", name: "achadinhosshopee", videoCount: 599255, viewCount: 1e10 },
  { id: "1697332031215622", name: "achadinhoshopee", videoCount: 47641, viewCount: 1e9 },
];

/** Roteia cada endpoint que o componente consome. */
function mockApi(overrides: { hashtagsFail?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/hashtags")) {
      if (overrides.hashtagsFail) {
        return { ok: false, status: 502, json: async () => ({ ok: false, hashtags: [] }) };
      }
      return { ok: true, json: async () => ({ ok: true, hashtags: HASHTAGS }) };
    }
    return { ok: true, json: async () => CONFIG };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ciclo de vida", () => {
  it("sobrevive à transição loading -> carregado sem quebrar os hooks", async () => {
    // Este é o teste que teria pego o bug de produção.
    mockApi();
    const erros: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => erros.push(a));

    render(<ShopeeConfigTab />);

    // Espera sair do spinner e o formulário aparecer
    await waitFor(() =>
      expect(screen.getByText(/Shopee Affiliate API/i)).toBeInTheDocument(),
    );

    const hookError = erros
      .flat()
      .map(String)
      .find((m) => /Rendered fewer hooks|Rendered more hooks|order of Hooks/i.test(m));
    expect(hookError).toBeUndefined();

    spy.mockRestore();
  });

  it("renderiza o seletor de hashtag depois de carregar", async () => {
    mockApi();

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Hashtags dos Achadinhos/i)).toBeInTheDocument(),
    );
  });
});

describe("seletor de hashtag", () => {
  it("reidrata as hashtags salvas a partir dos IDs", async () => {
    // O banco guarda só IDs separados por vírgula; os nomes vêm da busca.
    mockApi();

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText("#achadinhosshopee")).toBeInTheDocument(),
    );
  });

  it("busca hashtags no endpoint dedicado", async () => {
    const fetchMock = mockApi();

    render(<ShopeeConfigTab />);

    await waitFor(() => {
      const chamou = fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("/api/admin/settings/shopee/hashtags"),
      );
      expect(chamou).toBe(true);
    });
  });

  it("não quebra a tela quando a EchoTik falha", async () => {
    // Risk control é comum: a aba de configuração não pode cair junto.
    mockApi({ hashtagsFail: true });

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText(/Shopee Affiliate API/i)).toBeInTheDocument(),
    );
  });
});
