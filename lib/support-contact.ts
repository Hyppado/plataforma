/**
 * lib/support-contact.ts — Contatos de suporte (e-mail e WhatsApp).
 *
 * Antes os dois viviam num campo só, preenchido como
 * "clienteshyppado@gmail.com | whatsapp - (74) 99901-0441". Isso funcionava
 * para exibir, mas impedia o essencial: o `mailto:` levava a string inteira e
 * não havia como oferecer um link de WhatsApp.
 */

export const SUPPORT_EMAIL_DEFAULT = "clienteshyppado@gmail.com";
export const SUPPORT_WHATSAPP_DEFAULT = "";

/**
 * Extrai o endereço de e-mail de um valor que pode vir "sujo".
 *
 * O campo antigo era único e foi preenchido como
 * "clienteshyppado@gmail.com | whatsapp - (74) 99901-0441". Enquanto o admin
 * não regravar separado, a leitura precisa isolar o e-mail — senão o mailto:
 * levaria a string inteira e não abriria nada.
 */
export function extrairEmail(valor: string | null | undefined): string {
  if (!valor) return SUPPORT_EMAIL_DEFAULT;
  const m = valor.match(/[^\s|,;<>]+@[^\s|,;<>]+/);
  return (m?.[0] ?? valor).trim().toLowerCase();
}

/** DDI usado quando o número é informado só com DDD, como se escreve no Brasil. */
const DDI_BRASIL = "55";

/**
 * Converte o número digitado pelo admin no formato aceito pelo wa.me:
 * apenas dígitos, com DDI.
 *
 * Aceita as formas em que um número costuma ser escrito — "(74) 99901-0441",
 * "74 99901 0441", "+55 74 99901-0441" — porque exigir um formato exato só
 * geraria link quebrado quando alguém colasse do jeito de sempre.
 *
 * @returns Dígitos com DDI, ou null quando não há número utilizável.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digitos = raw.replace(/\D/g, "");
  if (!digitos) return null;

  // O "+" é declaração explícita de DDI. Sem ele, 11 dígitos são ambíguos:
  // podem ser celular brasileiro com DDD ou número estrangeiro com código de
  // país. Como o produto é brasileiro, o padrão é assumir Brasil — mas quem
  // escreveu "+1 415..." disse qual é o país, e isso manda.
  const ddiExplicito = raw.trim().startsWith("+");

  if (!ddiExplicito && (digitos.length === 10 || digitos.length === 11)) {
    digitos = DDI_BRASIL + digitos;
  }

  // Faixa do E.164. O piso não pode ser 12 (Brasil com DDI): número
  // estrangeiro legítimo é mais curto — os EUA têm 11 com o código do país.
  // Ainda assim recusa o que claramente não é telefone, porque link para
  // número incompleto abre uma conversa inexistente.
  if (digitos.length < 10 || digitos.length > 15) return null;

  return digitos;
}

/** Link de conversa, ou null quando o número não é utilizável. */
export function whatsAppLink(
  raw: string | null | undefined,
  mensagem?: string,
): string | null {
  const numero = toWhatsAppNumber(raw);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/**
 * Formata para leitura: "(74) 99901-0441".
 * Devolve o texto original quando não reconhece o formato — exibir o que o
 * admin escreveu é melhor do que exibir nada.
 */
export function formatWhatsApp(raw: string | null | undefined): string {
  const numero = toWhatsAppNumber(raw);
  if (!numero) return raw?.trim() ?? "";

  const semDdi = numero.startsWith(DDI_BRASIL) ? numero.slice(2) : numero;
  if (semDdi.length === 11) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
  }
  if (semDdi.length === 10) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  }
  return `+${numero}`;
}
