"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  Grid,
  LinearProgress,
  Tabs,
  Tab,
} from "@mui/material";
import type { Subscriber, SubscriptionMetrics } from "@/lib/types/admin";
import {
  getSubscribers,
  getSubscriptionMetrics,
} from "@/lib/admin/admin-client";
import { MetricsCards } from "@/app/components/admin/MetricsCards";
import { SubscribersTable } from "@/app/components/admin/SubscribersTable";
import { CostEstimateTab } from "@/app/components/admin/CostEstimateTab";

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriberTab, setSubscriberTab] = useState(0);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter =
        subscriberTab === 0
          ? "active"
          : subscriberTab === 1
            ? "canceled"
            : subscriberTab === 2
              ? "refunded"
              : subscriberTab === 3
                ? "past_due"
                : "nao_finalizadas";
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
      router.replace("/dashboard/videos");
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

      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => setActiveTab(v)}
        sx={{
          mb: 3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": { color: "rgba(255,255,255,0.5)", fontWeight: 600 },
          "& .Mui-selected": { color: "#2DD4FF" },
          "& .MuiTabs-indicator": { background: "#2DD4FF" },
        }}
      >
        <Tab label="Assinantes" />
        <Tab label="Custos" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <MetricsCards metrics={metrics} />

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
      )}

      {activeTab === 1 && <CostEstimateTab />}
    </Box>
  );
}
