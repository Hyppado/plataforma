"use client";

import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { BarChartOutlined } from "@mui/icons-material";
import type { EstimationResult } from "@/lib/types/echotik-admin";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

const ENTITY_LABELS: Record<string, string> = {
  videos: "Vídeos",
  products: "Produtos",
  creators: "Criadores",
};

function StatBox({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <Box
      sx={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 2,
        p: 2,
        textAlign: "center",
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#2DD4FF" }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        {unit && (
          <Typography
            component="span"
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.5)", ml: 0.5 }}
          >
            {unit}
          </Typography>
        )}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </Typography>
    </Box>
  );
}

interface EstimationSectionProps {
  data: EstimationResult | undefined;
  loading: boolean;
}

export function EstimationSection({ data, loading }: EstimationSectionProps) {
  if (loading) {
    return (
      <Grid item xs={12} md={6}>
        <Card sx={cardStyle}>
          <CardContent>
            <Skeleton
              variant="rectangular"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>
    );
  }

  if (!data) return null;

  const enabledEntities = data.breakdown.filter((e) => e.enabled);
  const capacityWarning = data.invocationsPerDay > 96;

  return (
    <Grid item xs={12} md={6}>
      <Card sx={cardStyle}>
        <CardHeader
          avatar={<BarChartOutlined sx={{ color: "#2DD4FF" }} />}
          title="Estimativa de Requisições"
          subheader="Por invocação × regiões × intervalos"
          titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
          subheaderTypographyProps={{ fontSize: "0.8rem" }}
        />
        <CardContent>
          <Stack spacing={3}>
            {/* High-level totals */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <StatBox
                  label="Total/dia"
                  value={data.totalRequestsPerDay}
                  unit="req"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatBox
                  label="Invocações/dia"
                  value={data.invocationsPerDay}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatBox
                  label="Req/tick (pior caso)"
                  value={data.requestsPerCronTick}
                  unit="req"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatBox
                  label="Capacidade (cron×dia)"
                  value={96}
                  unit="slots"
                />
              </Grid>
            </Grid>

            {/* Warning when over capacity */}
            {capacityWarning && (
              <Alert
                severity="warning"
                sx={{
                  background: "rgba(255, 152, 0, 0.08)",
                  border: "1px solid rgba(255, 152, 0, 0.2)",
                }}
              >
                Estimativa de {data.invocationsPerDay} invocações/dia excede 96
                slots disponíveis.
              </Alert>
            )}

            {/* Notes from estimation engine */}
            {data.notes.length > 0 && (
              <Box>
                {data.notes.map((note, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.5)", display: "block" }}
                  >
                    {note}
                  </Typography>
                ))}
              </Box>
            )}

            {/* Per-entity breakdown table */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Detalhamento por entidade
              </Typography>
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      Entidade
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      Probe
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      Dados
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "rgba(255,255,255,0.5)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      Total/dia
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enabledEntities.map((est) => (
                    <TableRow key={est.entity}>
                      <TableCell
                        sx={{
                          color: "#fff",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {ENTITY_LABELS[est.entity] ?? est.entity}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {est.probeCallsPerInvocation}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: "rgba(255,255,255,0.6)",
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {est.dataCallsPerInvocation}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: "#2DD4FF",
                          fontWeight: 600,
                          borderColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {est.requestsPerDay}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
