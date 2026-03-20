"use client";

import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  Stack,
  Chip,
  LinearProgress,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  CheckCircle,
  Cancel,
  PauseCircle,
  HourglassEmpty,
  Person,
  Email,
  CreditCard,
  TrendingUp,
  CloudDone,
  ReceiptLong,
} from "@mui/icons-material";
import Link from "next/link";
import { useQuotaUsage } from "@/lib/admin/useQuotaUsage";
import {
  useSubscription,
  formatCents,
  type SubscriptionStatus,
} from "@/lib/hooks/useSubscription";

// ============================================
// Design Tokens
// ============================================

const UI = {
  card: {
    bg: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(45,212,255,0.15)",
    radius: 3,
  },
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.70)",
    muted: "rgba(255,255,255,0.45)",
  },
  accent: "#2DD4FF",
  purple: "#AE87FF",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FF9800",
};

// ============================================
// Helper Functions
// ============================================

function getStatusIcon(status: SubscriptionStatus) {
  switch (status) {
    case "Ativa":
      return <CheckCircle sx={{ fontSize: 20, color: UI.success }} />;
    case "Cancelada":
      return <Cancel sx={{ fontSize: 20, color: UI.error }} />;
    case "Em atraso":
      return <PauseCircle sx={{ fontSize: 20, color: UI.warning }} />;
    case "Em análise":
      return <HourglassEmpty sx={{ fontSize: 20, color: UI.warning }} />;
  }
}

function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case "Ativa":
      return UI.success;
    case "Cancelada":
      return UI.error;
    case "Em atraso":
    case "Em análise":
      return UI.warning;
    default:
      return UI.text.muted;
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffMs = now - then;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "há alguns minutos";
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return "há 1 dia";
    return `há ${diffDays} dias`;
  } catch {
    return "—";
  }
}

// ============================================
// Main Component
// ============================================

export default function AssinaturaPage() {
  const quota = useQuotaUsage();
  const { data, loading, error } = useSubscription();

  const sub = data?.subscription;
  const member = data?.member;
  const billingHistory = data?.billingHistory ?? [];
  const hotmart = data?.hotmartIntegration ?? {
    connected: false,
    webhookConfigured: true,
    subscriberCode: null,
  };

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "1.5rem", md: "1.75rem" },
            fontWeight: 700,
            color: UI.text.primary,
            mb: 0.5,
          }}
        >
          Assinatura
        </Typography>
        <Typography
          sx={{
            fontSize: "0.875rem",
            color: UI.text.secondary,
          }}
        >
          Gerencie seu plano, limites e configurações de cobrança.
        </Typography>
      </Box>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={36} sx={{ color: UI.accent }} />
        </Box>
      )}

      {/* Error state */}
      {!loading && error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Não foi possível carregar os dados da assinatura: {error}
        </Alert>
      )}

      {/* Content */}
      {!loading && (
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {/* Left Column */}
          <Grid item xs={12} md={6}>
            <Stack spacing={{ xs: 2, md: 3 }}>
              {/* Plano Atual */}
              <Card
                sx={{
                  borderRadius: UI.card.radius,
                  background: UI.card.bg,
                  border: `1px solid ${UI.card.border}`,
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CreditCard sx={{ fontSize: 24, color: UI.accent }} />
                    <Typography
                      sx={{
                        fontSize: { xs: "1rem", md: "1.1rem" },
                        fontWeight: 600,
                        color: UI.text.primary,
                      }}
                    >
                      Plano Atual
                    </Typography>
                  </Box>

                  {sub ? (
                    <>
                      {/* Plan Name */}
                      <Box>
                        <Typography
                          sx={{
                            fontSize: "0.75rem",
                            color: UI.text.muted,
                            mb: 0.5,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Plano
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            color: UI.accent,
                          }}
                        >
                          {sub.planName}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.75rem",
                            color: UI.text.muted,
                            mt: 0.5,
                          }}
                        >
                          {sub.billingCycle}
                          {sub.displayPrice ? ` · ${sub.displayPrice}` : ""}
                        </Typography>
                      </Box>

                      {/* Status */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: 1.5,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${UI.card.border}`,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {getStatusIcon(sub.status)}
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              color: UI.text.secondary,
                            }}
                          >
                            Status
                          </Typography>
                        </Box>
                        <Chip
                          label={sub.status}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: `${getStatusColor(sub.status)}15`,
                            color: getStatusColor(sub.status),
                            border: `1px solid ${getStatusColor(sub.status)}30`,
                          }}
                        />
                      </Box>

                      {/* Dates */}
                      <Stack spacing={1.5}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography
                            sx={{ fontSize: "0.875rem", color: UI.text.secondary }}
                          >
                            Próxima renovação
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: UI.text.primary,
                            }}
                          >
                            {formatDate(sub.nextRenewalAt)}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography
                            sx={{ fontSize: "0.875rem", color: UI.text.secondary }}
                          >
                            Data de início
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: UI.text.primary,
                            }}
                          >
                            {formatDate(sub.startedAt)}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography
                            sx={{ fontSize: "0.875rem", color: UI.text.secondary }}
                          >
                            Produto
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: UI.text.primary,
                            }}
                          >
                            {sub.productName}
                          </Typography>
                        </Box>
                      </Stack>
                    </>
                  ) : (
                    <Typography
                      sx={{ fontSize: "0.875rem", color: UI.text.muted, fontStyle: "italic" }}
                    >
                      Nenhuma assinatura encontrada.
                    </Typography>
                  )}
                </Stack>
              </Card>

              {/* Conta do Membro */}
              <Card
                sx={{
                  borderRadius: UI.card.radius,
                  background: UI.card.bg,
                  border: `1px solid ${UI.card.border}`,
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Person sx={{ fontSize: 24, color: UI.purple }} />
                    <Typography
                      sx={{
                        fontSize: { xs: "1rem", md: "1.1rem" },
                        fontWeight: 600,
                        color: UI.text.primary,
                      }}
                    >
                      Conta do Membro
                    </Typography>
                  </Box>

                  <Stack spacing={2}>
                    {member?.name && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${UI.card.border}`,
                        }}
                      >
                        <Person sx={{ fontSize: 18, color: UI.text.muted }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{
                              fontSize: "0.7rem",
                              color: UI.text.muted,
                              mb: 0.3,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            Nome
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 500,
                              color: UI.text.primary,
                            }}
                          >
                            {member.name}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {member?.email && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${UI.card.border}`,
                        }}
                      >
                        <Email sx={{ fontSize: 18, color: UI.text.muted }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{
                              fontSize: "0.7rem",
                              color: UI.text.muted,
                              mb: 0.3,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            E-mail
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 500,
                              color: UI.text.primary,
                              wordBreak: "break-all",
                            }}
                          >
                            {member.email}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {!member && (
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          color: UI.text.muted,
                          fontStyle: "italic",
                        }}
                      >
                        Dados do membro não disponíveis.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Card>
            </Stack>
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} md={6}>
            <Stack spacing={{ xs: 2, md: 3 }}>
              {/* Limites do Período */}
              <Card
                sx={{
                  borderRadius: UI.card.radius,
                  background: UI.card.bg,
                  border: `1px solid ${UI.card.border}`,
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <TrendingUp sx={{ fontSize: 24, color: UI.accent }} />
                    <Typography
                      sx={{
                        fontSize: { xs: "1rem", md: "1.1rem" },
                        fontWeight: 600,
                        color: UI.text.primary,
                      }}
                    >
                      Limites do Período
                    </Typography>
                  </Box>

                  {/* Transcrições */}
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: UI.text.primary,
                        }}
                      >
                        Transcrições
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: UI.accent,
                        }}
                      >
                        {quota.transcripts.used ?? "—"} /{" "}
                        {sub?.transcriptsPerMonth ?? quota.transcripts.max}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={
                        quota.transcripts.used !== null
                          ? Math.min(
                              (quota.transcripts.used /
                                (sub?.transcriptsPerMonth ?? quota.transcripts.max)) *
                                100,
                              100,
                            )
                          : 0
                      }
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        background: "rgba(45,212,255,0.1)",
                        "& .MuiLinearProgress-bar": {
                          background: `linear-gradient(90deg, ${UI.accent} 0%, rgba(45,212,255,0.7) 100%)`,
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>

                  {/* Roteiros */}
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: UI.text.primary,
                        }}
                      >
                        Roteiros
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: UI.purple,
                        }}
                      >
                        {quota.scripts.used ?? "—"} /{" "}
                        {sub?.scriptsPerMonth ?? quota.scripts.max}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={
                        quota.scripts.used !== null
                          ? Math.min(
                              (quota.scripts.used /
                                (sub?.scriptsPerMonth ?? quota.scripts.max)) *
                                100,
                              100,
                            )
                          : 0
                      }
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        background: "rgba(174,135,255,0.1)",
                        "& .MuiLinearProgress-bar": {
                          background: `linear-gradient(90deg, ${UI.purple} 0%, rgba(174,135,255,0.7) 100%)`,
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      mt: 1,
                      p: 1.5,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${UI.card.border}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        color: UI.text.muted,
                        fontStyle: "italic",
                      }}
                    >
                      Os limites são renovados mensalmente com base no seu plano.
                    </Typography>
                  </Box>
                </Stack>
              </Card>

              {/* Integração Hotmart */}
              <Card
                sx={{
                  borderRadius: UI.card.radius,
                  background: UI.card.bg,
                  border: `1px solid ${UI.card.border}`,
                  p: { xs: 2, md: 3 },
                }}
              >
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CloudDone
                      sx={{
                        fontSize: 24,
                        color: hotmart.connected ? UI.accent : UI.text.muted,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: { xs: "1rem", md: "1.1rem" },
                        fontWeight: 600,
                        color: UI.text.primary,
                      }}
                    >
                      Integração Hotmart
                    </Typography>
                  </Box>

                  {/* Status */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.5,
                      borderRadius: 2,
                      background: hotmart.connected
                        ? "rgba(45,212,255,0.08)"
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${
                        hotmart.connected
                          ? "rgba(45,212,255,0.25)"
                          : UI.card.border
                      }`,
                    }}
                  >
                    <Typography
                      sx={{ fontSize: "0.875rem", color: UI.text.secondary }}
                    >
                      Status
                    </Typography>
                    <Chip
                      label={hotmart.connected ? "Conectado" : "Não configurado"}
                      size="small"
                      icon={
                        hotmart.connected ? (
                          <CheckCircle sx={{ fontSize: 16 }} />
                        ) : undefined
                      }
                      sx={{
                        height: 24,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: hotmart.connected
                          ? `${UI.accent}20`
                          : "rgba(255,255,255,0.05)",
                        color: hotmart.connected ? UI.accent : UI.text.muted,
                        border: `1px solid ${
                          hotmart.connected
                            ? `${UI.accent}40`
                            : "rgba(255,255,255,0.1)"
                        }`,
                        "& .MuiChip-icon": {
                          color: hotmart.connected ? UI.accent : UI.text.muted,
                        },
                      }}
                    />
                  </Box>

                  {/* Webhook */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.5,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${UI.card.border}`,
                    }}
                  >
                    <Typography
                      sx={{ fontSize: "0.875rem", color: UI.text.secondary }}
                    >
                      Webhook configurado
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: hotmart.webhookConfigured ? UI.success : UI.text.muted,
                      }}
                    >
                      {hotmart.webhookConfigured ? "Sim" : "Não"}
                    </Typography>
                  </Box>

                  {/* Endpoint Info */}
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: "rgba(45,212,255,0.05)",
                      border: "1px solid rgba(45,212,255,0.15)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.7rem",
                        color: UI.text.muted,
                        mb: 0.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Endpoint configurado
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        color: UI.accent,
                        wordBreak: "break-all",
                      }}
                    >
                      /api/webhooks/hotmart
                    </Typography>
                  </Box>

                  {/* CTA */}
                  <Button
                    component={Link}
                    href="/app/suporte"
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderRadius: 2,
                      textTransform: "none",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      borderColor: UI.card.border,
                      color: UI.text.primary,
                      py: 1,
                      "&:hover": {
                        borderColor: UI.accent,
                        background: "rgba(45,212,255,0.08)",
                      },
                    }}
                  >
                    Ver instruções de configuração
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Grid>

          {/* Full Width - Histórico */}
          <Grid item xs={12}>
            <Card
              sx={{
                borderRadius: UI.card.radius,
                background: UI.card.bg,
                border: `1px solid ${UI.card.border}`,
                p: { xs: 2, md: 3 },
              }}
            >
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <ReceiptLong sx={{ fontSize: 24, color: UI.accent }} />
                  <Typography
                    sx={{
                      fontSize: { xs: "1rem", md: "1.1rem" },
                      fontWeight: 600,
                      color: UI.text.primary,
                    }}
                  >
                    Histórico de Cobrança
                  </Typography>
                </Box>

                {billingHistory.length === 0 ? (
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      color: UI.text.muted,
                      fontStyle: "italic",
                      py: 2,
                      textAlign: "center",
                    }}
                  >
                    Nenhum pagamento registrado.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {billingHistory.map((event) => (
                      <Box
                        key={event.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: { xs: 1.5, md: 2 },
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${UI.card.border}`,
                          transition: "all 180ms ease",
                          "&:hover": {
                            background: "rgba(255,255,255,0.04)",
                            borderColor: UI.card.borderHover,
                          },
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              mb: 0.3,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                color: UI.text.primary,
                              }}
                            >
                              {event.type}
                            </Typography>
                            <Chip
                              label={event.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                background:
                                  event.status === "Aprovado"
                                    ? `${UI.success}15`
                                    : event.status === "Estornado"
                                    ? `${UI.warning}15`
                                    : "rgba(255,255,255,0.05)",
                                color:
                                  event.status === "Aprovado"
                                    ? UI.success
                                    : event.status === "Estornado"
                                    ? UI.warning
                                    : UI.text.muted,
                                border: `1px solid ${
                                  event.status === "Aprovado"
                                    ? `${UI.success}30`
                                    : event.status === "Estornado"
                                    ? `${UI.warning}30`
                                    : UI.card.border
                                }`,
                              }}
                            />
                          </Box>
                          <Typography
                            sx={{ fontSize: "0.75rem", color: UI.text.muted }}
                          >
                            {formatDate(event.createdAt)} · {event.reference}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            color: UI.accent,
                            ml: 2,
                          }}
                        >
                          {event.amountCents > 0
                            ? formatCents(event.amountCents, event.currency)
                            : "—"}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}
