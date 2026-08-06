/**
 * Tests: app/components/shopee/ShopeeAchadinhoCard.tsx
 *
 * O cabeçalho do componente marca a separação de links como "correção
 * crítica": clicar no produto vai para a Shopee (link de afiliado), clicar no
 * vídeo abre o player do TikTok. Cruzar os dois manda o usuário para o lugar
 * errado e quebra a atribuição da comissão.
 *
 * Cobre também a visibilidade do botão de admin (editar link de afiliado).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShopeeAchadinhoDTO } from "@/lib/swr/useShopee";

// Sessão controlável por teste (o setup global fixa "unauthenticated")
const mockSession: { data: unknown; status: string } = {
  data: null,
  status: "unauthenticated",
};

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Persistência de "salvos" — irrelevante para estes testes
vi.mock("@/lib/storage/saved", () => ({
  useSavedVideos: () => ({
    isSaved: () => false,
    toggle: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { ShopeeAchadinhoCard } from "@/app/components/shopee/ShopeeAchadinhoCard";

const SHOPEE_URL = "https://shope.ee/affiliate-abc";
const TIKTOK_URL = "https://www.tiktok.com/@creator/video/7300000000000000000";

function buildAchadinho(
  overrides: Partial<ShopeeAchadinhoDTO> = {},
): ShopeeAchadinhoDTO {
  return {
    id: "ach-1",
    videoExternalId: "7300000000000000000",
    videoUrl: TIKTOK_URL,
    videoTitle: "achadinho top",
    coverUrl: "https://cdn/cover.jpg",
    transcriptText: "texto da transcrição",
    productName: "Fone de Ouvido Bluetooth",
    category: "Eletrônicos",
    affiliateLink: SHOPEE_URL,
    originalAffLink: "https://shopee.com.br/product/1",
    price: 49.9,
    saleCount: 120,
    views: 1_500_000,
    commission: 8.5,
    authorName: "creator",
    status: "READY",
    errorMessage: null,
    productImageUrl: "https://cdn/product.jpg",
    productPriceMin: 45,
    productPriceMax: 55,
    productLink: "https://shopee.com.br/product/1",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  } as ShopeeAchadinhoDTO;
}

function renderCard(overrides: Partial<ShopeeAchadinhoDTO> = {}) {
  return render(
    <ShopeeAchadinhoCard achadinho={buildAchadinho(overrides)} rank={1} />,
  );
}

/** Todos os href de âncora renderizados. */
function anchorHrefs(): string[] {
  return Array.from(document.querySelectorAll("a[href]")).map(
    (a) => a.getAttribute("href") ?? "",
  );
}

beforeEach(() => {
  mockSession.data = null;
  mockSession.status = "unauthenticated";
});

describe("separação de links (correção crítica)", () => {
  it("o link de compra aponta para a Shopee, não para o TikTok", () => {
    renderCard();

    const hrefs = anchorHrefs();
    expect(hrefs).toContain(SHOPEE_URL);
  });

  it("NENHUMA âncora de compra aponta para o TikTok", () => {
    // A regressão temida: o botão de compra levar para o vídeo
    renderCard();

    for (const href of anchorHrefs()) {
      expect(href).not.toContain("tiktok.com");
    }
  });

  it("o link de compra abre em nova aba com rel seguro", () => {
    renderCard();

    const anchor = document.querySelector(`a[href="${SHOPEE_URL}"]`);
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toContain("noopener");
  });

  it("não renderiza âncora de compra quando não há link de afiliado", () => {
    renderCard({ affiliateLink: null } as Partial<ShopeeAchadinhoDTO>);

    expect(anchorHrefs()).not.toContain(SHOPEE_URL);
  });

  it("usa o affiliateLink editado pelo admin, não o originalAffLink", () => {
    // originalAffLink existe apenas como histórico — nunca é o destino
    const editado = "https://shope.ee/editado-pelo-admin";
    renderCard({ affiliateLink: editado });

    const hrefs = anchorHrefs();
    expect(hrefs).toContain(editado);
    expect(hrefs).not.toContain("https://shopee.com.br/product/1");
  });
});

describe("conteúdo do card", () => {
  it("mostra o nome do produto", () => {
    renderCard();
    expect(screen.getByText(/Fone de Ouvido Bluetooth/i)).toBeInTheDocument();
  });

  it("renderiza sem quebrar quando o pipeline não extraiu produto", () => {
    expect(() =>
      renderCard({
        productName: null,
        productImageUrl: null,
      } as Partial<ShopeeAchadinhoDTO>),
    ).not.toThrow();
  });

  it("renderiza sem quebrar sem capa nem preço", () => {
    expect(() =>
      renderCard({
        coverUrl: null,
        price: null,
      } as Partial<ShopeeAchadinhoDTO>),
    ).not.toThrow();
  });
});

describe("ação de admin", () => {
  it("esconde o botão de editar link para usuário comum", () => {
    mockSession.data = { user: { role: "USER" } };
    mockSession.status = "authenticated";

    renderCard();

    expect(
      screen.queryByRole("button", { name: /editar link/i }),
    ).not.toBeInTheDocument();
  });

  it("esconde o botão de editar link para visitante não autenticado", () => {
    renderCard();

    expect(
      screen.queryByRole("button", { name: /editar link/i }),
    ).not.toBeInTheDocument();
  });

  it("mostra o botão de editar link para ADMIN", () => {
    mockSession.data = { user: { role: "ADMIN" } };
    mockSession.status = "authenticated";

    renderCard();

    expect(
      screen.getByRole("button", { name: /editar link/i }),
    ).toBeInTheDocument();
  });
});
