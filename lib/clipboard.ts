/**
 * lib/clipboard.ts — Cópia para a área de transferência com fallback.
 *
 * POR QUE NÃO BASTA navigator.clipboard
 * A Clipboard API não está sempre disponível, e quando falha, falha calada:
 *
 *   - `navigator.clipboard` é undefined fora de contexto seguro (http://,
 *     acesso por IP, alguns webviews) — acessar `.writeText` ali lança
 *     TypeError, não uma rejeição de promise;
 *   - `writeText` rejeita com NotAllowedError quando o documento não está em
 *     foco ou a permissão foi negada;
 *   - navegadores mais antigos simplesmente não a implementam.
 *
 * Em todos esses casos o usuário clica no ícone e nada acontece. O fallback com
 * `document.execCommand("copy")` cobre exatamente essas situações: é obsoleto,
 * mas continua funcionando onde a API moderna não vai.
 */

/**
 * Copia `text`. Devolve `true` só quando a cópia realmente aconteceu.
 *
 * Texto vazio devolve `false` em vez de "sucesso": copiar nada e mostrar o
 * check verde faz o usuário colar e não achar nada, o que é pior do que ver
 * que falhou.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Caminho moderno. O optional chaining evita o TypeError quando
  // `navigator.clipboard` não existe.
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cai no fallback abaixo em vez de desistir.
  }

  // Fallback: seleção + execCommand. Precisa de um nó visível ao navegador,
  // então o textarea fica fora da tela em vez de `display: none` — elemento
  // não renderizado não é selecionável.
  if (typeof document === "undefined") return false;

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);

    const selecaoAnterior = document.getSelection()?.rangeCount
      ? document.getSelection()!.getRangeAt(0)
      : null;

    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    area.remove();

    // Devolve ao usuário a seleção que ele tinha antes do clique.
    if (selecaoAnterior) {
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(selecaoAnterior);
    }

    return ok;
  } catch {
    return false;
  }
}
