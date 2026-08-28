// @vitest-environment jsdom
/**
 * __tests__/lib/clipboard.test.ts
 *
 * A cópia falhava calada: o usuário clicava no ícone de copiar o prompt e nada
 * acontecia, sem erro na tela. Estes testes cobrem os caminhos em que a
 * Clipboard API não está disponível — que eram exatamente os que produziam o
 * clique inerte.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";

const original = globalThis.navigator;

function comClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText } },
    configurable: true,
    writable: true,
  });
}

function semClipboard() {
  Object.defineProperty(globalThis, "navigator", {
    value: {},
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  (document as unknown as { execCommand: unknown }).execCommand = vi
    .fn()
    .mockReturnValue(true);
});

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: original,
    configurable: true,
    writable: true,
  });
});

describe("copyTextToClipboard", () => {
  it("usa a Clipboard API quando disponível", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    comClipboard(writeText);

    await expect(copyTextToClipboard("prompt gerado")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("prompt gerado");
  });

  /**
   * Contexto inseguro (http://, acesso por IP, webview): `navigator.clipboard`
   * é undefined e o acesso direto a `.writeText` lançaria TypeError.
   */
  it("cai no fallback quando navigator.clipboard não existe", async () => {
    semClipboard();

    await expect(copyTextToClipboard("prompt gerado")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  /** Documento sem foco ou permissão negada: writeText rejeita. */
  it("cai no fallback quando a Clipboard API rejeita", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    comClipboard(writeText);

    await expect(copyTextToClipboard("prompt gerado")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("devolve false quando nem o fallback funciona", async () => {
    semClipboard();
    (document as unknown as { execCommand: unknown }).execCommand = vi
      .fn()
      .mockReturnValue(false);

    await expect(copyTextToClipboard("prompt gerado")).resolves.toBe(false);
  });

  /**
   * Copiar string vazia e sinalizar sucesso levava o usuário a colar e não
   * achar nada — pior do que ver que falhou.
   */
  it("recusa texto vazio em vez de fingir sucesso", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    comClipboard(writeText);

    await expect(copyTextToClipboard("")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("não deixa o textarea do fallback no DOM", async () => {
    semClipboard();

    await copyTextToClipboard("prompt gerado");

    expect(document.querySelectorAll("textarea").length).toBe(0);
  });
});
