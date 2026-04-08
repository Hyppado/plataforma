"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, Typography } from "@mui/material";
import { NotificationsTab } from "@/app/components/admin/notifications/NotificationsTab";

export default function NotificacoesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "ADMIN") {
      router.replace("/dashboard/videos");
    }
  }, [session, status, router]);

  if (status === "loading" || !session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 1 }}>
          Notificações
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>
          Eventos importantes da Hotmart e do sistema
        </Typography>
      </Box>
      <NotificationsTab />
    </Box>
  );
}
