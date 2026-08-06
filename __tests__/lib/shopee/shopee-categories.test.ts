/**
 * __tests__/lib/shopee/shopee-categories.test.ts
 *
 * Cobre a resolução de categorias da Shopee — o mapa de productCatIds e o
 * fallback textual usado pelo pipeline de achadinhos.
 */

import { describe, it, expect } from "vitest";
import {
  mapShopeeCategories,
  resolveCategoryFromText,
  buildShopeeCategoryTree,
  matchesShopeeCategory,
} from "@/lib/shopee/shopee-categories";

describe("resolveCategoryFromText", () => {
  it("resolve por correspondência exata da keyword do ranking", () => {
    expect(resolveCategoryFromText("perfume")).toEqual({
      parent: "Beleza e Saúde",
      child: "Perfumes",
    });
  });

  it("normaliza espaços e caixa antes de comparar", () => {
    expect(resolveCategoryFromText("  PERFUME  ")).toEqual({
      parent: "Beleza e Saúde",
      child: "Perfumes",
    });
  });

  it("resolve por substring — caso dos nomes extraídos pelo GPT", () => {
    // O pipeline de achadinhos passa o nome do produto, não uma keyword.
    expect(resolveCategoryFromText("fone de ouvido bluetooth gamer")).toEqual({
      parent: "Eletrônicos",
      child: "Fones e Áudio",
    });
  });

  it("prefere a chave mais longa quando mais de uma casa", () => {
    // "fone de ouvido" (14) deve vencer "fone bluetooth" no texto abaixo.
    expect(resolveCategoryFromText("fone de ouvido bluetooth")).toEqual({
      parent: "Eletrônicos",
      child: "Fones e Áudio",
    });
  });

  it("retorna null quando nada casa", () => {
    expect(resolveCategoryFromText("mini panqueca elétrica")).toBeNull();
  });

  it("retorna null para texto vazio", () => {
    expect(resolveCategoryFromText("")).toBeNull();
    expect(resolveCategoryFromText("   ")).toBeNull();
  });
});

describe("mapShopeeCategories", () => {
  it("resolve pelo ID conhecido da categoria L1", () => {
    expect(mapShopeeCategories([100632, 999], "irrelevante")).toEqual({
      categoryId: "100632",
      subCategoryId: "999",
      categoryName: "Eletrônicos",
      subCategoryName: "Fones e Áudio",
    });
  });

  it("cai no fallback textual quando o ID é desconhecido", () => {
    const result = mapShopeeCategories([424242], "perfume importado feminino");
    expect(result.categoryName).toBe("Beleza e Saúde");
    expect(result.subCategoryName).toBe("Perfumes");
    expect(result.categoryId).toBe("424242");
  });

  it("resolve sem nenhum catId — caso do achadinho sem oferta na Shopee", () => {
    const result = mapShopeeCategories([], "capa celular transparente");
    expect(result.categoryName).toBe("Eletrônicos");
    expect(result.subCategoryName).toBe("Acessórios para Celular");
    expect(result.categoryId).toBeNull();
    expect(result.subCategoryId).toBeNull();
  });

  it("retorna nomes nulos quando ID e texto são desconhecidos", () => {
    expect(mapShopeeCategories([424242], "produto sem categoria")).toEqual({
      categoryId: "424242",
      subCategoryId: null,
      categoryName: null,
      subCategoryName: null,
    });
  });

  it("não quebra com catIds undefined", () => {
    const result = mapShopeeCategories(
      undefined as unknown as number[],
      "notebook",
    );
    expect(result.categoryName).toBe("Eletrônicos");
    expect(result.categoryId).toBeNull();
  });
});

describe("buildShopeeCategoryTree", () => {
  it("agrupa subcategorias sob a categoria pai, ordenadas", () => {
    const tree = buildShopeeCategoryTree([
      { categoryName: "Eletrônicos", subCategoryName: "Monitores" },
      { categoryName: "Eletrônicos", subCategoryName: "Fones e Áudio" },
      { categoryName: "Eletrônicos", subCategoryName: "Monitores" },
      { categoryName: "Beleza e Saúde", subCategoryName: "Perfumes" },
    ]);

    expect(tree).toEqual([
      { parent: "Beleza e Saúde", children: ["Perfumes"] },
      { parent: "Eletrônicos", children: ["Fones e Áudio", "Monitores"] },
    ]);
  });

  it("ignora produtos sem categoria pai", () => {
    const tree = buildShopeeCategoryTree([
      { categoryName: null, subCategoryName: "Órfã" },
      { categoryName: "  ", subCategoryName: "Vazia" },
      { categoryName: "Automotivo e Motocicletas", subCategoryName: null },
    ]);

    expect(tree).toEqual([
      { parent: "Automotivo e Motocicletas", children: [] },
    ]);
  });
});

describe("matchesShopeeCategory", () => {
  const produto = {
    categoryName: "Eletrônicos",
    subCategoryName: "Fones e Áudio",
  };

  it("aceita tudo quando nenhuma categoria está selecionada", () => {
    expect(matchesShopeeCategory(produto, "")).toBe(true);
  });

  it("casa pela categoria pai", () => {
    expect(matchesShopeeCategory(produto, "Eletrônicos")).toBe(true);
    expect(matchesShopeeCategory(produto, "Beleza e Saúde")).toBe(false);
  });

  it("casa pelo formato composto parent::child", () => {
    expect(
      matchesShopeeCategory(produto, "Eletrônicos::Fones e Áudio"),
    ).toBe(true);
    expect(matchesShopeeCategory(produto, "Eletrônicos::Monitores")).toBe(
      false,
    );
  });
});
