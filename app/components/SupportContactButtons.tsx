"use client";

import { Box, Button } from "@mui/material";
import { Email, WhatsApp } from "@mui/icons-material";
import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";

export interface SupportContacts {
  email: string;
  whatsapp: string;
  whatsappUrl: string | null;
}

/**
 * Lê os contatos de suporte.
 *
 * `publica` escolhe a rota: a versão sem autenticação serve landing, login e
 * /suporte; a autenticada serve o dashboard. As duas devolvem a mesma forma.
 */
export function useSupportContacts(publica = false) {
  const { data } = useSWR<SupportContacts>(
    publica ? "/api/public/support-email" : "/api/support-email",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );
  return data;
}

/**
 * Botões de contato do suporte: e-mail e WhatsApp.
 *
 * O botão do WhatsApp só aparece quando há número configurado — botão que
 * leva a uma conversa inexistente é pior do que botão ausente.
 *
 * Centralizado porque os mesmos dois contatos aparecem na landing, no rodapé,
 * na página pública de suporte e no dashboard; repetir a montagem do link em
 * cada tela faria uma delas ficar para trás na próxima mudança.
 */
export function SupportContactButtons({
  publica = false,
  tamanho = "large",
  mensagemWhatsApp = "Olá! Preciso de ajuda com a Hyppado.",
  full = false,
}: {
  publica?: boolean;
  tamanho?: "small" | "medium" | "large";
  /** Texto que já vai preenchido na conversa. */
  mensagemWhatsApp?: string;
  full?: boolean;
}) {
  const contatos = useSupportContacts(publica);
  if (!contatos) return null;

  const urlZap = contatos.whatsappUrl
    ? `${contatos.whatsappUrl}${contatos.whatsappUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(mensagemWhatsApp)}`
    : null;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        flexWrap: "wrap",
        justifyContent: full ? "stretch" : "center",
        width: "100%",
      }}
    >
      <Button
        variant="contained"
        size={tamanho}
        startIcon={<Email />}
        href={`mailto:${contatos.email}`}
        sx={{
          flex: full ? 1 : "0 0 auto",
          background: "linear-gradient(135deg, #2DD4FF 0%, #00B8E6 100%)",
          color: "#0A0F18",
          fontWeight: 600,
          px: 3,
          borderRadius: 2,
          textTransform: "none",
          "&:hover": {
            background: "linear-gradient(135deg, #00B8E6 0%, #0098BF 100%)",
          },
        }}
      >
        Enviar e-mail
      </Button>

      {urlZap && (
        <Button
          variant="contained"
          size={tamanho}
          startIcon={<WhatsApp />}
          href={urlZap}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            flex: full ? 1 : "0 0 auto",
            // Verde do WhatsApp: o botão é reconhecido pela cor antes do texto.
            background: "#25D366",
            color: "#0A0F18",
            fontWeight: 600,
            px: 3,
            borderRadius: 2,
            textTransform: "none",
            "&:hover": { background: "#1EBE5A" },
          }}
        >
          WhatsApp
        </Button>
      )}
    </Box>
  );
}
