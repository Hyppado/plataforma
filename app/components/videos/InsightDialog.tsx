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
  Collapse,
} from "@mui/material";
import {
  ContentCopy,
  Close,
  Check,
  AutoAwesome,
  Refresh,
  Stars,
  Phishing,
  HeartBroken,
  Lightbulb,
  RocketLaunch,
  LocalFireDepartment,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InsightUIStatus = "idle" | "loading" | "READY" | "FAILED";

export interface InsightData {
  contextText: string | null;
  hookText: string | null;
  problemText: string | null;
  solutionText: string | null;
  ctaText: string | null;
  copyWorkedText: string | null;
}

interface InsightDialogProps {
  open: boolean;
  onClose: () => void;
  videoTitle?: string;
  status: InsightUIStatus;
  data: InsightData | null;
  errorMessage: string | null;
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// Insight Hyppado section config
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    key: "contextText" as const,
    label: "Contexto",
    icon: Stars,
    color: "#B388FF",
    description: "O que o vídeo aborda",
  },
  {
    key: "hookText" as const,
    label: "Gancho",
    icon: Phishing,
    color: "#FFD54F",
    description: "Técnica usada para capturar atenção",
  },
  {
    key: "problemText" as const,
    label: "Problema",
    icon: HeartBroken,
    color: "#FF8A80",
    description: "Dor ou problema apresentado",
  },
  {
    key: "solutionText" as const,
    label: "Solução",
    icon: Lightbulb,
    color: "#69F0AE",
    description: "Como a solução é apresentada",
  },
  {
    key: "ctaText" as const,
    label: "CTA",
    icon: RocketLaunch,
    color: "#40C4FF",
    description: "Call-to-action e urgência",
  },
  {
    key: "copyWorkedText" as const,
    label: "Copie o que Funcionou",
    icon: LocalFireDepartment,
    color: "#FF6E40",
    description: "Roteiro reutilizável e adaptável",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightDialog({
  open,
  onClose,
  videoTitle,
  status,
  data,
  errorMessage,
  onRetry,
}: InsightDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "copyWorkedText",
  );

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(key);
      setTimeout(() => setCopiedSection(null), 1500);
    } catch {
      // ignore
    }
  };

  const handleCopyAll = async () => {
    if (!data) return;
    const full = SECTIONS.map((s) => {
      const text = data[s.key];
      return `## ${s.label}\n${text || "—"}`;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(full);
      setCopiedSection("__all__");
      setTimeout(() => setCopiedSection(null), 1500);
    } catch {
      // ignore
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  };

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
          maxHeight: "90vh",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Box sx={{ flex: 1, pr: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <AutoAwesome sx={{ fontSize: 20, color: "#B388FF" }} />
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              Insight Hyppado
            </Typography>
          </Box>
          <Typography
            sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}
          >
            Análise estruturada dos elementos persuasivos do vídeo.
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {videoTitle}
          </Typography>
        )}

        {/* Loading state */}
        {status === "loading" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
              gap: 2,
            }}
          >
            <CircularProgress size={36} sx={{ color: "#B388FF" }} />
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.6)",
                textAlign: "center",
              }}
            >
              Gerando Insight Hyppado...
              <br />
              <Typography
                component="span"
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}
              >
                Isso pode levar alguns segundos
              </Typography>
            </Typography>
          </Box>
        )}

        {/* Failed state */}
        {status === "FAILED" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              gap: 2,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "rgba(255,100,100,0.9)",
                textAlign: "center",
              }}
            >
              {errorMessage || "Não foi possível gerar o insight."}
            </Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={onRetry}
              sx={{
                color: "#B388FF",
                textTransform: "none",
                fontSize: "0.8125rem",
                "&:hover": { background: "rgba(179,136,255,0.08)" },
              }}
            >
              Tentar novamente
            </Button>
          </Box>
        )}

        {/* Idle state */}
        {status === "idle" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              gap: 1,
            }}
          >
            <AutoAwesome
              sx={{ fontSize: 32, color: "rgba(179,136,255,0.4)" }}
            />
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.5)",
                textAlign: "center",
              }}
            >
              Clique para gerar o insight deste vídeo.
            </Typography>
          </Box>
        )}

        {/* Ready state — Insight Hyppado cards */}
        {status === "READY" && data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {SECTIONS.map((section) => {
              const text = data[section.key];
              const Icon = section.icon;
              const isExpanded = expandedSection === section.key;
              const isCopySection = section.key === "copyWorkedText";
              const hasContent = !!text;

              return (
                <Box
                  key={section.key}
                  sx={{
                    background: `${section.color}08`,
                    border: `1px solid ${section.color}20`,
                    borderRadius: 2,
                    overflow: "hidden",
                    transition: "border-color 160ms ease",
                    "&:hover": {
                      borderColor: `${section.color}40`,
                    },
                  }}
                >
                  {/* Section header */}
                  <Box
                    onClick={() => hasContent && toggleSection(section.key)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      cursor: hasContent ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    <Icon
                      sx={{
                        fontSize: 18,
                        color: section.color,
                        opacity: 0.85,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: section.color,
                        flex: 1,
                      }}
                    >
                      {section.label}
                    </Typography>

                    {hasContent && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(section.key, text!);
                        }}
                        sx={{
                          color:
                            copiedSection === section.key
                              ? "#69F0AE"
                              : "rgba(255,255,255,0.4)",
                          p: 0.5,
                          "&:hover": { color: "rgba(255,255,255,0.7)" },
                        }}
                      >
                        {copiedSection === section.key ? (
                          <Check sx={{ fontSize: 14 }} />
                        ) : (
                          <ContentCopy sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    )}

                    {hasContent &&
                      (isExpanded ? (
                        <ExpandLess
                          sx={{
                            fontSize: 18,
                            color: "rgba(255,255,255,0.35)",
                          }}
                        />
                      ) : (
                        <ExpandMore
                          sx={{
                            fontSize: 18,
                            color: "rgba(255,255,255,0.35)",
                          }}
                        />
                      ))}
                  </Box>

                  {/* Section content */}
                  <Collapse in={isExpanded && hasContent}>
                    <Box
                      sx={{
                        px: 1.5,
                        pb: 1.5,
                        pt: 0,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: isCopySection ? "0.8125rem" : "0.8125rem",
                          lineHeight: 1.7,
                          color: "rgba(255,255,255,0.82)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          ...(isCopySection && {
                            background: "rgba(255,106,64,0.06)",
                            border: "1px solid rgba(255,106,64,0.12)",
                            borderRadius: 1.5,
                            p: 1.5,
                            fontFamily:
                              "ui-monospace, Menlo, Monaco, monospace",
                            fontSize: "0.78rem",
                          }),
                        }}
                      >
                        {text || "Não identificado no vídeo."}
                      </Typography>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            color: "rgba(255,255,255,0.6)",
            textTransform: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            "&:hover": { background: "rgba(255,255,255,0.05)" },
          }}
        >
          Fechar
        </Button>
        {status === "READY" && data && (
          <Button
            variant="contained"
            startIcon={
              copiedSection === "__all__" ? <Check /> : <ContentCopy />
            }
            onClick={handleCopyAll}
            disabled={copiedSection === "__all__"}
            sx={{
              background:
                copiedSection === "__all__"
                  ? "rgba(76,175,80,0.85)"
                  : "linear-gradient(135deg, #B388FF 0%, #B388FFDD 100%)",
              color: "#fff",
              textTransform: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              px: 3,
              boxShadow:
                copiedSection === "__all__"
                  ? "0 4px 12px rgba(76,175,80,0.4)"
                  : "0 4px 12px rgba(179,136,255,0.4)",
              "&:hover": {
                background:
                  copiedSection === "__all__"
                    ? "rgba(76,175,80,0.85)"
                    : "linear-gradient(135deg, #B388FFEE 0%, #B388FFCC 100%)",
              },
              "&:disabled": {
                background: "rgba(76,175,80,0.85)",
                color: "#fff",
              },
              transition: "all 180ms ease",
            }}
          >
            {copiedSection === "__all__" ? "Copiado" : "Copiar tudo"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
