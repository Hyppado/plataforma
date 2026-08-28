/**
 * __tests__/lib/support-contact.test.ts
 *
 * E-mail e WhatsApp do suporte viviam num campo só, preenchido como
 * "clienteshyppado@gmail.com | whatsapp - (74) 99901-0441". Dava para exibir,
 * mas o `mailto:` levava a string inteira e não abria nada.
 *
 * Estes testes cobrem a separação e a montagem do link de conversa — um
 * número mal convertido gera link que abre uma conversa inexistente, falha
 * que ninguém percebe até um cliente reclamar.
 */

import { describe, it, expect } from "vitest";
import {
  extrairEmail,
  toWhatsAppNumber,
  whatsAppLink,
  formatWhatsApp,
  SUPPORT_EMAIL_DEFAULT,
} from "@/lib/support-contact";

describe("extrairEmail", () => {
  it("isola o e-mail do valor legado com os dois contatos juntos", () => {
    expect(
      extrairEmail("clienteshyppado@gmail.com | whatsapp - (74) 99901-0441"),
    ).toBe("clienteshyppado@gmail.com");
  });

  it("devolve um e-mail limpo inalterado", () => {
    expect(extrairEmail("suporte@hyppado.com")).toBe("suporte@hyppado.com");
  });

  it("normaliza caixa e espaços", () => {
    expect(extrairEmail("  Suporte@Hyppado.COM ")).toBe("suporte@hyppado.com");
  });

  it("cai no padrão quando não há valor", () => {
    expect(extrairEmail(null)).toBe(SUPPORT_EMAIL_DEFAULT);
  });
});

describe("toWhatsAppNumber", () => {
  /** O admin escreve como está acostumado; exigir formato exato só quebraria. */
  it.each([
    ["(74) 99901-0441", "5574999010441"],
    ["74 99901 0441", "5574999010441"],
    ["74999010441", "5574999010441"],
    ["+55 74 99901-0441", "5574999010441"],
    ["55 (74) 99901-0441", "5574999010441"],
  ])("aceita %s", (entrada, esperado) => {
    expect(toWhatsAppNumber(entrada)).toBe(esperado);
  });

  it("acrescenta o DDI quando vem só com DDD", () => {
    expect(toWhatsAppNumber("11 98765-4321")).toBe("5511987654321");
  });

  it("preserva número que já tem DDI estrangeiro", () => {
    expect(toWhatsAppNumber("+1 415 555 2671")).toBe("14155552671");
  });

  /** Link para número incompleto abriria uma conversa inexistente. */
  it("recusa número curto demais", () => {
    expect(toWhatsAppNumber("99901")).toBeNull();
    expect(toWhatsAppNumber("(74) 9990")).toBeNull();
  });

  it("recusa texto sem dígitos e vazio", () => {
    expect(toWhatsAppNumber("whatsapp")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});

describe("whatsAppLink", () => {
  it("monta o endereço de conversa", () => {
    expect(whatsAppLink("(74) 99901-0441")).toBe("https://wa.me/5574999010441");
  });

  it("inclui a mensagem pré-preenchida, codificada", () => {
    const url = whatsAppLink("(74) 99901-0441", "Olá! Preciso de ajuda");
    expect(url).toContain("?text=");
    expect(url).toContain("Ol%C3%A1");
  });

  /** Null é o sinal para a interface esconder o botão. */
  it("devolve null quando o número não serve", () => {
    expect(whatsAppLink("")).toBeNull();
    expect(whatsAppLink("123")).toBeNull();
  });
});

describe("formatWhatsApp", () => {
  it("formata celular com nove dígitos", () => {
    expect(formatWhatsApp("5574999010441")).toBe("(74) 99901-0441");
  });

  it("formata fixo com oito dígitos", () => {
    expect(formatWhatsApp("557433334444")).toBe("(74) 3333-4444");
  });

  /** Exibir o que o admin escreveu é melhor do que exibir nada. */
  it("devolve o texto original quando não reconhece", () => {
    expect(formatWhatsApp("ligar no ramal 12")).toBe("ligar no ramal 12");
  });

  it("devolve vazio para entrada vazia", () => {
    expect(formatWhatsApp(null)).toBe("");
  });
});
