"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
} from "@mui/material";
import {
  ContentCopy,
  Close,
  Check,
  ErrorOutline,
  Refresh,
} from "@mui/icons-material";

type TranscriptStatus = "idle" | "loading" | "READY" | "FAILED";

interface TranscriptDialogProps {
  open: boolean;
  onClose: () => void;
  transcriptText: string | null;
  videoTitle?: string;
  status: TranscriptStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
}

/**
 * Maps backend error messages to user-friendly Portuguese messages.
 */
function formatErrorMessage(error: string): string {
  if (error.includes("API key not configured")) {
    return "Chave OpenAI não configurada. Peça ao administrador para configurar.";
  }
  if (error.includes("download URL not available")) {
    return "Não foi possível obter o vídeo para transcrição.";
  }
  if (error.includes("download failed") || error.includes("too large")) {
    return "O download do vídeo falhou ou o arquivo é muito grande.";
  }
  if (error.includes("Whisper transcription returned no text")) {
    return "A transcrição não retornou texto. O vídeo pode não ter áudio.";
  }
  return "Erro inesperado. Tente novamente.";
}

export function TranscriptDialog({
  open,
  onClose,
  transcriptText,
  videoTitle,
  status,
  errorMessage,
  onRetry,
}: TranscriptDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isLoading = status === "loading";
  const isFailed = status === "FAILED";
  const isReady = status === "READY" && !!transcriptText;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: "linear-gradient(165deg, #0D1422 0%, #0A0F18 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
          backdropFilter: "blur(20px)",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              mb: 0.25,
            }}
          >
            Transcrição
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {isReady
              ? "Copie e cole onde quiser."
              : isFailed
                ? "Não foi possível transcrever este vídeo."
                : isLoading
                  ? "Transcrevendo o vídeo..."
                  : "Solicite a transcrição do vídeo."}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "rgba(255,255,255,0.5)",
            "&:hover": { color: "rgba(255,255,255,0.8)" },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pb: 0 }}>
        {videoTitle && (
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.68)",
              mb: 1.5,
              pb: 1.5,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {videoTitle}
          </Typography>
        )}

        {/* Loading state */}
        {isLoading && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
            }}
          >
            <CircularProgress size={32} sx={{ color: "#2DD4FF" }} />
            <Typography
              sx={{
                ml: 2,
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.875rem",
              }}
            >
              Transcrevendo o vídeo... pode levar até 30 segundos.
            </Typography>
          </Box>
        )}

        {/* Failed state */}
        {isFailed && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 6,
              gap: 2,
            }}
          >
            <ErrorOutline
              sx={{ fontSize: 40, color: "rgba(255,100,100,0.7)" }}
            />
            <Typography
              sx={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              Não foi possível transcrever este vídeo.
              <br />
              {errorMessage
                ? formatErrorMessage(errorMessage)
                : "Erro inesperado. Tente novamente."}
            </Typography>
            {onRetry && (
              <Button
                startIcon={<Refresh />}
                onClick={onRetry}
                sx={{
                  mt: 1,
                  color: "#2DD4FF",
                  textTransform: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Tentar novamente
              </Button>
            )}
          </Box>
        )}

        {/* Ready — transcript text */}
        {isReady && (
          <Box
            sx={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 2,
              p: 2,
              maxHeight: "400px",
              overflowY: "auto",
              fontFamily: "ui-monospace, Menlo, Monaco, monospace",
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "rgba(0,0,0,0.2)",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(255,255,255,0.15)",
                borderRadius: "4px",
                "&:hover": {
                  background: "rgba(255,255,255,0.25)",
                },
              },
            }}
          >
            {transcriptText}
          </Box>
        )}

        {/* Idle state */}
        {status === "idle" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 6,
              gap: 2,
            }}
          >
            <Typography
              sx={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              Transcrição não disponível.
              <br />
              Clique em &quot;Transcrever&quot; para solicitar.
            </Typography>
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button
          onClick={onClose}
          sx={{
            color: "rgba(255,255,255,0.6)",
            textTransform: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            "&:hover": {
              background: "rgba(255,255,255,0.05)",
            },
          }}
        >
          Fechar
        </Button>
        {isReady && (
          <Button
            variant="contained"
            startIcon={copied ? <Check /> : <ContentCopy />}
            onClick={handleCopy}
            disabled={copied}
            sx={{
              background: copied
                ? "rgba(76,175,80,0.85)"
                : "linear-gradient(135deg, #2DD4FF 0%, #2DD4FFDD 100%)",
              color: "#fff",
              textTransform: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              px: 3,
              boxShadow: copied
                ? "0 4px 12px rgba(76,175,80,0.4)"
                : "0 4px 12px rgba(45,212,255,0.4)",
              "&:hover": {
                background: copied
                  ? "rgba(76,175,80,0.85)"
                  : "linear-gradient(135deg, #2DD4FFEE 0%, #2DD4FFCC 100%)",
                boxShadow: copied
                  ? "0 6px 16px rgba(76,175,80,0.5)"
                  : "0 6px 16px rgba(45,212,255,0.6)",
              },
              "&:disabled": {
                background: "rgba(76,175,80,0.85)",
                color: "#fff",
              },
              transition: "all 180ms ease",
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
