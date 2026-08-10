/**
 * Tests: lib/echotik/trending.ts — rangeToCycles
 *
 * O REGRESSO QUE ESTES TESTES EXISTEM PARA PEGAR
 * O "1d" era o único range sem fallback de ciclo. O ranklist da EchoTik é
 * dado OFFLINE — a doc diz que ele tem atraso e que resposta vazia significa
 * apenas que a EchoTik ainda não coletou aquele dia. Quando o ranking diário
 * atrasava, /dashboard/videos?range=1d abria completamente vazio, enquanto
 * 7d e 30d seguiam mostrando conteúdo por já caírem em outro ciclo.
 */
import { describe, it, expect } from "vitest";
import { rangeToCycles } from "@/lib/echotik/trending";

describe("rangeToCycles()", () => {
  it("pede o ciclo correspondente ao range", () => {
    expect(rangeToCycles("1d").requested).toBe(1);
    expect(rangeToCycles("7d").requested).toBe(2);
    expect(rangeToCycles("30d").requested).toBe(3);
  });

  it("1d tem fallback — não fica vazio quando o diário atrasa", () => {
    const { candidates } = rangeToCycles("1d");

    expect(candidates[0]).toBe(1);
    expect(candidates.length).toBeGreaterThan(1);
  });

  it("todo range tenta o próprio ciclo primeiro", () => {
    for (const range of ["1d", "7d", "30d"] as const) {
      const { requested, candidates } = rangeToCycles(range);
      expect(candidates[0]).toBe(requested);
    }
  });

  it("todo range cobre os três ciclos", () => {
    // Nenhum range pode ficar sem alternativa: qualquer ciclo pode vir vazio.
    for (const range of ["1d", "7d", "30d"] as const) {
      expect([...rangeToCycles(range).candidates].sort()).toEqual([1, 2, 3]);
    }
  });

  it("não repete ciclo na lista de candidatos", () => {
    for (const range of ["1d", "7d", "30d"] as const) {
      const { candidates } = rangeToCycles(range);
      expect(new Set(candidates).size).toBe(candidates.length);
    }
  });
});
