import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Typography,
  Divider,
  Button,
  TextField,
  LinearProgress,
  Stack,
  Box,
} from "@mui/material";
import {
  Check as CheckIcon,
  Save as SaveIcon,
  SubtitlesOutlined,
  TerminalOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import type { QuotaPolicy, QuotaUsage } from "@/lib/types/admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

function formatUsage(
  used: number | null | undefined,
  max: number | null | undefined,
): string {
  const usedStr = used != null ? used.toLocaleString("pt-BR") : "—";
  const maxStr = max != null ? max.toLocaleString("pt-BR") : "—";
  return `${usedStr} / ${maxStr}`;
}

interface LimitsSectionProps {
  quotaPolicy: QuotaPolicy | null;
  quotaUsage: QuotaUsage;
  transcriptsLimit: string;
  scriptsLimit: string;
  limitsSaved: boolean;
  onTranscriptsLimitChange: (value: string) => void;
  onScriptsLimitChange: (value: string) => void;
  onSave: () => void;
}

export function LimitsSection({
  quotaPolicy,
  quotaUsage,
  transcriptsLimit,
  scriptsLimit,
  limitsSaved,
  onTranscriptsLimitChange,
  onScriptsLimitChange,
  onSave,
}: LimitsSectionProps) {
  return (
    <Grid item xs={12} md={6} lg={4}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<SettingsOutlined sx={{ color: "#2DD4FF" }} />}
          title="Limites & Créditos"
          subheader="Configuração de quotas mensais"
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
          action={
            <Button
              variant="contained"
              size="small"
              startIcon={limitsSaved ? <CheckIcon /> : <SaveIcon />}
              onClick={onSave}
              sx={{
                background: limitsSaved
                  ? "rgba(76, 175, 80, 0.2)"
                  : "linear-gradient(135deg, #2DD4FF, #7B61FF)",
                color: limitsSaved ? "#81C784" : "#fff",
                fontWeight: 600,
                minWidth: 80,
              }}
            >
              {limitsSaved ? "Salvo!" : "Salvar"}
            </Button>
          }
        />
        <CardContent>
          <Stack spacing={2.5}>
            {/* Transcripts limit */}
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <SubtitlesOutlined sx={{ fontSize: 18, color: "#2DD4FF" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Transcrições / mês
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TextField
                  value={transcriptsLimit}
                  onChange={(e) => onTranscriptsLimitChange(e.target.value)}
                  size="small"
                  type="number"
                  sx={{
                    width: 100,
                    "& .MuiOutlinedInput-root": {
                      background: "rgba(0,0,0,0.2)",
                    },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Uso:{" "}
                  {formatUsage(
                    quotaUsage.transcriptsUsed,
                    parseInt(transcriptsLimit) ||
                      quotaPolicy?.transcriptsPerMonth,
                  )}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={
                  quotaUsage.transcriptsUsed != null
                    ? Math.min(
                        (quotaUsage.transcriptsUsed /
                          (parseInt(transcriptsLimit) || 40)) *
                          100,
                        100,
                      )
                    : 0
                }
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.1)",
                  "& .MuiLinearProgress-bar": {
                    background: "linear-gradient(90deg, #2DD4FF, #7B61FF)",
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
            {/* Scripts limit */}
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <TerminalOutlined sx={{ fontSize: 18, color: "#CE93D8" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Roteiros (Scripts) / mês
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TextField
                  value={scriptsLimit}
                  onChange={(e) => onScriptsLimitChange(e.target.value)}
                  size="small"
                  type="number"
                  sx={{
                    width: 100,
                    "& .MuiOutlinedInput-root": {
                      background: "rgba(0,0,0,0.2)",
                    },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Uso:{" "}
                  {formatUsage(
                    quotaUsage.scriptsUsed,
                    parseInt(scriptsLimit) || quotaPolicy?.scriptsPerMonth,
                  )}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={
                  quotaUsage.scriptsUsed != null
                    ? Math.min(
                        (quotaUsage.scriptsUsed /
                          (parseInt(scriptsLimit) || 70)) *
                          100,
                        100,
                      )
                    : 0
                }
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.1)",
                  "& .MuiLinearProgress-bar": {
                    background: "linear-gradient(90deg, #7B61FF, #F472B6)",
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
