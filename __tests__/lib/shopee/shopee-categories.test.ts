/**
 * __tests__/lib/shopee/shopee-categories.test.ts
 *
 * Cobre a tradução de categorias da Shopee a partir da dimensão oficial.
 *
 * O comportamento anterior — mapa de IDs escrito à mão mais palpite pela
 * palavra-chave da busca — foi removido por estar errado: dizia que 100016 era
 * "Beleza e Saúde/Perfumes" quando é "Bolsas Femininas", e por isso filtrar
 * saúde trazia bolsas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  shopeeCategory: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

import {
  mapShopeeCategories,
  buildShopeeCategoryTree,
  matchesShopeeCategory,
  invalidarCacheCategorias,
} from "@/lib/shopee/shopee-categories";

/** Recorte real da taxonomia da Shopee BR. */
const DIMENSAO = [
  { categoryId: 100016, name: "Bolsas Femininas", level: 1, parentId: null },
  { categoryId: 100095, name: "Bolsas de Ombro", level: 2, parentId: 100016 },
  { categoryId: 100630, name: "Beleza", level: 1, parentId: null },
  { categoryId: 100659, name: "Cabelos", level: 2, parentId: 100630 },
  { categoryId: 100001, name: "Saúde", level: 1, parentId: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  invalidarCacheCategorias();
  prismaMock.shopeeCategory.findMany.mockResolvedValue(DIMENSAO);
});

describe("mapShopeeCategories", () => {
  it("traduz productCatIds pela dimensão oficial", async () => {
    const r = await mapShopeeCategories([100016, 100095, 0]);
    expect(r.categoryId).toBe("100016");
    expect(r.categoryName).toBe("Bolsas Femininas");
    expect(r.subCategoryId).toBe("100095");
    expect(r.subCategoryName).toBe("Bolsas de Ombro");
  });

  /**
   * O caso exato relatado em produção: três bolsas apareciam sob
   * "Beleza e Saúde › Perfumes" porque o mapa antigo errava o 100016.
   */
  it("classifica 100016 como Bolsas Femininas, não como beleza", async () => {
    const r = await mapShopeeCategories([100016, 100095, 0]);
    expect(r.categoryName).toBe("Bolsas Femininas");
    expect(r.categoryName).not.toMatch(/beleza|sa[úu]de/i);
  });

  it("classifica 100630 como Beleza, não como eletrônicos", async () => {
    const r = await mapShopeeCategories([100630, 100659, 0]);
    expect(r.categoryName).toBe("Beleza");
    expect(r.subCategoryName).toBe("Cabelos");
  });

  it("trata 0 como nível ausente", async () => {
    const r = await mapShopeeCategories([100001, 0, 0]);
    expect(r.categoryName).toBe("Saúde");
    expect(r.subCategoryId).toBeNull();
    expect(r.subCategoryName).toBeNull();
  });

  /**
   * Nome nulo é melhor do que nome errado: o card fica sem categoria em vez de
   * entrar na categoria de outro produto, e o nulo aparece na auditoria.
   */
  it("devolve nulo para ID fora da dimensão, sem inventar", async () => {
    const r = await mapShopeeCategories([999999, 0, 0]);
    expect(r.categoryId).toBe("999999");
    expect(r.categoryName).toBeNull();
  });

  it("lida com productCatIds ausente", async () => {
    const r = await mapShopeeCategories(null);
    expect(r.categoryId).toBeNull();
    expect(r.categoryName).toBeNull();
  });

  it("não consulta o banco a cada produto", async () => {
    await mapShopeeCategories([100016, 0, 0]);
    await mapShopeeCategories([100630, 0, 0]);
    await mapShopeeCategories([100001, 0, 0]);
    expect(prismaMock.shopeeCategory.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("buildShopeeCategoryTree", () => {
  it("monta a árvore a partir da dimensão, não dos produtos carregados", async () => {
    prismaMock.shopeeCategory.findMany
      .mockResolvedValueOnce(DIMENSAO.filter((c) => c.level === 1))
      .mockResolvedValueOnce(DIMENSAO.filter((c) => c.level === 2));

    const arvore = await buildShopeeCategoryTree();
    const nomes = arvore.map((n) => n.parent);
    expect(nomes).toContain("Bolsas Femininas");
    expect(nomes).toContain("Beleza");
    expect(nomes).toContain("Saúde");
    expect(arvore.find((n) => n.parent === "Beleza")?.children).toEqual([
      "Cabelos",
    ]);
  });

  it("restringe às categorias que têm produto, quando informado", async () => {
    prismaMock.shopeeCategory.findMany
      .mockResolvedValueOnce(DIMENSAO.filter((c) => c.level === 1))
      .mockResolvedValueOnce(DIMENSAO.filter((c) => c.level === 2));

    const arvore = await buildShopeeCategoryTree(new Set(["100630"]));
    expect(arvore.map((n) => n.parent)).toEqual(["Beleza"]);
  });
});

describe("matchesShopeeCategory", () => {
  const bolsa = {
    categoryName: "Bolsas Femininas",
    subCategoryName: "Bolsas de Ombro",
  };

  it("sem seleção, aceita tudo", () => {
    expect(matchesShopeeCategory(bolsa, "")).toBe(true);
  });

  it("casa pela categoria pai", () => {
    expect(matchesShopeeCategory(bolsa, "Bolsas Femininas")).toBe(true);
    expect(matchesShopeeCategory(bolsa, "Saúde")).toBe(false);
  });

  it("casa pela subcategoria composta", () => {
    expect(
      matchesShopeeCategory(bolsa, "Bolsas Femininas::Bolsas de Ombro"),
    ).toBe(true);
    expect(matchesShopeeCategory(bolsa, "Beleza::Cabelos")).toBe(false);
  });

  /** A regressão que o usuário viu: bolsa aparecendo ao filtrar saúde. */
  it("bolsa não aparece ao filtrar saúde", () => {
    expect(matchesShopeeCategory(bolsa, "Saúde")).toBe(false);
    expect(matchesShopeeCategory(bolsa, "Beleza")).toBe(false);
  });
});
