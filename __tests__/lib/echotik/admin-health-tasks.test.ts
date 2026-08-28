/**
 * __tests__/lib/echotik/admin-health-tasks.test.ts
 *
 * O painel operacional só reconhecia cinco tarefas. As de manutenção —
 * details, upload-images, cache-download-urls e cleanup-orphans — rodavam sem
 * aparecer: o parse do `source` as descartava, então uma parada nelas não
 * gerava sinal nenhum, mesmo sendo elas que sustentam o que a tela exibe.
 *
 * Estes testes travam o contrato entre a lista de tarefas, os rótulos e o que
 * o orquestrador realmente agenda.
 */

import { describe, it, expect } from "vitest";
import {
  GLOBAL_TASKS,
  TASK_LABELS,
  type IngestionTaskType,
} from "@/lib/types/echotik-admin";

/** Tudo que o orquestrador agenda hoje (lib/echotik/cron/orchestrator.ts). */
const TAREFAS_AGENDADAS: IngestionTaskType[] = [
  "categories",
  "videos",
  "products",
  "creators",
  "new-products",
  "details",
  "upload-images",
  "cache-download-urls",
  "cleanup-orphans",
];

describe("catálogo de tarefas do painel", () => {
  it("cobre as tarefas de manutenção que ficavam invisíveis", () => {
    for (const t of [
      "details",
      "upload-images",
      "cache-download-urls",
      "cleanup-orphans",
    ] as const) {
      expect(TAREFAS_AGENDADAS).toContain(t);
      expect(TASK_LABELS[t]).toBeTruthy();
    }
  });

  /** Tarefa sem rótulo apareceria no painel com a chave crua. */
  it("todo tipo de tarefa tem rótulo em português", () => {
    for (const t of TAREFAS_AGENDADAS) {
      expect(TASK_LABELS[t]).toBeTruthy();
      expect(TASK_LABELS[t]).not.toBe(t);
    }
  });

  /**
   * Tarefa global listada como se tivesse região renderiza uma linha por
   * região, sugerindo que roda várias vezes quando roda uma só.
   */
  it("as tarefas de manutenção são globais, não por região", () => {
    for (const t of [
      "details",
      "upload-images",
      "cache-download-urls",
      "cleanup-orphans",
    ] as const) {
      expect(GLOBAL_TASKS).toContain(t);
    }
  });

  it("as tarefas de ranking NÃO são globais — rodam por região", () => {
    for (const t of ["videos", "products", "creators", "new-products"] as const) {
      expect(GLOBAL_TASKS).not.toContain(t);
    }
  });

  it("nenhuma tarefa agendada fica de fora do catálogo de rótulos", () => {
    const comRotulo = Object.keys(TASK_LABELS).sort();
    expect(comRotulo).toEqual([...TAREFAS_AGENDADAS].sort());
  });
});
