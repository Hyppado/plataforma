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
import { ACHADINHOS_MAX_HASHTAGS } from "@/lib/shopee/types";

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
    // A config traz a seleção já resolvida — a tela não redescobre nomes.
    return {
      ok: true,
      json: async () => ({
        ...CONFIG,
        achadinhosHashtags: HASHTAGS.map((h) => ({ id: h.id, name: h.name })),
      }),
    };
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
  it("desenha os chips da seleção salva", async () => {
    // Os nomes vêm do banco junto dos IDs, não de uma busca na EchoTik.
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

describe("teto de hashtags", () => {
  /** Config com N hashtags salvas e as opções correspondentes na busca. */
  function mockComNHashtags(n: number) {
    const tags = Array.from({ length: n }, (_, i) => ({
      id: String(1000000000000000 + i),
      name: `tag${i}`,
      videoCount: 1000,
      viewCount: 1e6,
    }));
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/hashtags")) {
        return { ok: true, json: async () => ({ ok: true, hashtags: tags }) };
      }
      return {
        ok: true,
        json: async () => ({
          ...CONFIG,
          achadinhosHashtagId: tags.map((t) => `${t.id}|${t.name}`).join(","),
          achadinhosHashtags: tags.map((t) => ({ id: t.id, name: t.name })),
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    return tags;
  }

  it("declara o limite no rótulo do campo", async () => {
    // O admin precisa saber o teto ANTES de tentar passar dele.
    mockApi();

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(
        screen.getByLabelText(
          new RegExp(`Hashtags dos Achadinhos \\(máx\\. ${ACHADINHOS_MAX_HASHTAGS}\\)`, "i"),
        ),
      ).toBeInTheDocument(),
    );
  });

  it("mostra o progresso em relação ao teto quando há seleção", async () => {
    mockApi(); // CONFIG traz 2 hashtags

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(
        screen.getByText(new RegExp(`2 de ${ACHADINHOS_MAX_HASHTAGS} hashtags`)),
      ).toBeInTheDocument(),
    );
  });

  it("avisa que o limite foi atingido no máximo", async () => {
    mockComNHashtags(ACHADINHOS_MAX_HASHTAGS);

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText(/Limite de .* atingido/i)).toBeInTheDocument(),
    );
  });
});

describe("seleção salva não depende da EchoTik", () => {
  /** Config salva com nomes; a busca de hashtags SEMPRE falha. */
  function mockBuscaForaDoAr() {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/hashtags")) {
        // Risk control da EchoTik — rotineiro em produção
        return { ok: false, status: 502, json: async () => ({ ok: false, hashtags: [] }) };
      }
      return {
        ok: true,
        json: async () => ({
          ...CONFIG,
          achadinhosHashtagId: "1696392324325382|achadinhosshopee,1697332031215622|achadinhoshopee",
          achadinhosHashtags: [
            { id: "1696392324325382", name: "achadinhosshopee" },
            { id: "1697332031215622", name: "achadinhoshopee" },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("mostra as hashtags salvas mesmo com a busca da EchoTik falhando", async () => {
    // ESTE é o bug relatado: as hashtags estavam salvas no banco, mas os chips
    // sumiam ao recarregar a página porque os nomes eram redescobertos por uma
    // busca na EchoTik — que responde risk control com frequência.
    mockBuscaForaDoAr();

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText("#achadinhosshopee")).toBeInTheDocument(),
    );
    expect(screen.getByText("#achadinhoshopee")).toBeInTheDocument();
  });

  it("conta as salvas no contador do limite", async () => {
    mockBuscaForaDoAr();

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(
        screen.getByText(new RegExp(`2 de ${ACHADINHOS_MAX_HASHTAGS} hashtags`)),
      ).toBeInTheDocument(),
    );
  });

  it("config antiga sem nome mostra o ID em vez de sumir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/hashtags")) {
          return { ok: false, status: 502, json: async () => ({ ok: false, hashtags: [] }) };
        }
        return {
          ok: true,
          json: async () => ({
            ...CONFIG,
            achadinhosHashtagId: "1696392324325382",
            achadinhosHashtags: [{ id: "1696392324325382", name: "" }],
          }),
        };
      }),
    );

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText("#1696392324325382")).toBeInTheDocument(),
    );
  });
});

describe("enriquecimento de nomes (config antiga)", () => {
  it("preenche o nome de uma hashtag salva só com ID quando a busca a devolve", async () => {
    // Migração do formato antigo: o chip aparece como ID e vira nome assim
    // que a busca funcionar. Nunca no sentido inverso.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/hashtags")) {
          return { ok: true, json: async () => ({ ok: true, hashtags: HASHTAGS }) };
        }
        return {
          ok: true,
          json: async () => ({
            ...CONFIG,
            achadinhosHashtagId: "1696392324325382",
            achadinhosHashtags: [{ id: "1696392324325382", name: "" }],
          }),
        };
      }),
    );

    render(<ShopeeConfigTab />);

    await waitFor(() =>
      expect(screen.getByText("#achadinhosshopee")).toBeInTheDocument(),
    );
  });
});
