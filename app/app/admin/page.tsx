"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  Button,
  TextField,
  LinearProgress,
  Stack,
} from "@mui/material";
import { ConfirmationNumberOutlined } from "@mui/icons-material";
import type { Subscriber, SubscriptionMetrics } from "@/lib/types/admin";
import {
  getSubscribers,
  getSubscriptionMetrics,
} from "@/lib/admin/admin-client";
import { MetricsCards } from "@/app/components/admin/MetricsCards";
import { SubscribersTable } from "@/app/components/admin/SubscribersTable";

const cardStyle = {
  background: "rgba(10, 15, 24, 0.8)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 3,
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriberTab, setSubscriberTab] = useState(0);
  const [subscriberSearch, setSubscriberSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter =
        subscriberTab === 0
          ? "active"
          : subscriberTab === 1
            ? "canceled"
            : "past_due";
      const [subsData, metricsData] = await Promise.all([
        getSubscribers(statusFilter, 1, 100, subscriberSearch || undefined),
        getSubscriptionMetrics(),
      ]);
      setSubscribers(subsData.subscribers);
      setTotalSubscribers(subsData.pagination.total);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  }, [subscriberTab, subscriberSearch]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      router.replace("/app/videos");
      return;
    }
    loadData();
  }, [session, status, router, loadData]);

  if (status === "loading" || !session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: "#fff", mb: 1 }}
          >
            Admin
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
            Assinantes, métricas e operações
          </Typography>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        <MetricsCards metrics={metrics} />

        {/* Coupons (Coming Soon) */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={cardStyle}>
            <CardHeader
              avatar={<ConfirmationNumberOutlined sx={{ color: "#2DD4FF" }} />}
              title="Cupons"
              subheader="Gerenciamento de cupons"
              titleTypographyProps={{ fontWeight: 600, fontSize: "1rem" }}
              subheaderTypographyProps={{ fontSize: "0.8rem" }}
            />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Código do Cupom"
                  placeholder="Ex: DESCONTO20"
                  disabled
                  fullWidth
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      background: "rgba(0,0,0,0.2)",
                    },
                  }}
                />
                <TextField
                  label="Desconto (%)"
                  placeholder="Ex: 20"
                  disabled
                  fullWidth
                  size="small"
                  type="number"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      background: "rgba(0,0,0,0.2)",
                    },
                  }}
                />
                <Button
                  variant="contained"
                  disabled
                  sx={{
                    background: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  Em breve
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <SubscribersTable
          subscribers={subscribers}
          totalSubscribers={totalSubscribers}
          metrics={metrics}
          loading={loading}
          subscriberTab={subscriberTab}
          subscriberSearch={subscriberSearch}
          onTabChange={setSubscriberTab}
          onSearchChange={setSubscriberSearch}
        />
      </Grid>
    </Box>
  );
}
