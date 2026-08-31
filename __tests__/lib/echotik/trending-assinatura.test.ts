/**
 * Tests: lib/echotik/trending.ts — assinaturaVencida / publicImageUrl
 *
 * O QUE ESTES TESTES SEGURAM
 * A EchoTik devolve a capa de duas formas. Quase sempre é o CDN dela própria,
 * permanente: 1179 de 1179 dessas viraram blob. Às vezes é a URL crua do
 * TikTok, assinada e com `x-expires` — e dessas só 3 de 21 vingaram.
 *
 * A causa não é lentidão do cron: nas 18 que falharam a assinatura já estava
 * vencida quando a linha foi gravada (mediana de 24h vencida, a menos ruim com
 * 9,5h). Não existe janela para acertar. Sem este filtro elas voltavam para a
 * fila de upload a cada ciclo e, por serem re-sincronizadas, subiam ao topo da
 * ordenação e ocupavam vagas do lote — e ainda chegavam ao card, onde só
 * podiam virar imagem quebrada.
 */

import { describe, it, expect } from "vitest";
import { assinaturaVencida, publicImageUrl } from "@/lib/echotik/trending";

const AGORA = Date.parse("2026-08-31T12:00:00Z");
const seg = (iso: string) => Math.floor(Date.parse(iso) / 1000);

const tiktok = (expiraEm: string) =>
  `https://p19-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/abc~tplv.heic` +
  `?x-expires=${seg(expiraEm)}&x-signature=oqw9mxHKtDGL7HQeTZGMwv9dA2I%3D`;

describe("assinaturaVencida", () => {
  it("reconhece assinatura já expirada", () => {
    expect(assinaturaVencida(tiktok("2026-08-30T12:00:00Z"), AGORA)).toBe(true);
  });

  it("aceita assinatura ainda válida", () => {
    expect(assinaturaVencida(tiktok("2026-09-01T12:00:00Z"), AGORA)).toBe(false);
  });

  /** Sem `x-expires` não há validade a checar — o CDN da EchoTik é permanente. */
  it("não julga URL sem assinatura", () => {
    expect(
      assinaturaVencida(
        "https://echosell-images.tos-ap-southeast-1.volces.com/video-cover/855/1.jpg",
        AGORA,
      ),
    ).toBe(false);
  });

  it("não julga URL malformada nem x-expires ilegível", () => {
    expect(assinaturaVencida("nao-e-url", AGORA)).toBe(false);
    expect(assinaturaVencida("https://cdn/a.jpg?x-expires=abc", AGORA)).toBe(
      false,
    );
    expect(assinaturaVencida("https://cdn/a.jpg?x-expires=0", AGORA)).toBe(
      false,
    );
  });
});

describe("publicImageUrl com assinatura", () => {
  /**
   * Entregar a URL vencida ao card garante imagem quebrada; devolver vazio faz
   * o card usar o próprio estado de "sem imagem", que é o degradê aceitável.
   */
  it("descarta capa do TikTok com assinatura vencida", () => {
    expect(publicImageUrl(tiktok("2020-01-01T00:00:00Z"))).toBe("");
  });

  it("deixa passar capa do TikTok ainda assinada", () => {
    const url = tiktok("2099-01-01T00:00:00Z");
    expect(publicImageUrl(url)).toBe(url);
  });

  it("segue descartando o CDN da EchoTik, que responde 403 sem assinar", () => {
    expect(
      publicImageUrl(
        "https://echosell-images.tos-ap-southeast-1.volces.com/video-cover/855/1.jpg",
      ),
    ).toBe("");
  });

  it("respeita o fallback informado", () => {
    expect(publicImageUrl(tiktok("2020-01-01T00:00:00Z"), "/vazio.png")).toBe(
      "/vazio.png",
    );
  });
});
