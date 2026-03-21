import { NextRequest, NextResponse } from "next/server";
import type { AlertDTO } from "@/lib/types/dto";

// Mock alerts (in production, use Prisma)
const mockAlerts: AlertDTO[] = [
  {
    id: "alert-1",
    title: "Novo produto em alta: Skincare",
    description: "Gel Redutor Noturno detectado com 1.2K menções em 24h",
    severity: "success",
    type: "new_product",
    payload: { productId: "prod-10-gel-redutor", category: "Beleza" },
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-2",
    title: "Creator em ascensão",
    description: "@anafit ganhou 50K seguidores essa semana",
    severity: "info",
    type: "creator_rise",
    payload: { creatorId: "creator-2-anafit", growth: 0.15 },
    read: false,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-3",
    title: "ROAS alto detectado",
    description: "Vídeo de @joaotech com ROAS 8.5x acima da média",
    severity: "success",
    type: "high_roas",
    payload: { videoId: "vid-1-review-honesta", roas: 8.5 },
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-4",
    title: "Tendência: Tech Gadgets",
    description: "Categoria Eletrônicos cresceu 45% vs semana passada",
    severity: "info",
    type: "trend",
    payload: { category: "Eletrônicos", growth: 0.45 },
    read: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-5",
    title: "Produto salvo está viralizando",
    description: "Fone Bluetooth Pro Max teve +200% de vendas",
    severity: "warning",
    type: "saved_trending",
    payload: { productId: "prod-1-fone-bluetooth", salesGrowth: 2.0 },
    read: false,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);
    const unreadOnly = searchParams.get("unread") === "true";

    let alerts = [...mockAlerts];

    if (unreadOnly) {
      alerts = alerts.filter((alert) => !alert.read);
    }

    // Sort by date, newest first
    alerts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const limitedAlerts = alerts.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: limitedAlerts,
        total: alerts.length,
        unreadCount: alerts.filter((a) => !a.read).length,
      },
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, read } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Alert ID is required" },
        { status: 400 },
      );
    }

    // In production, update in Prisma
    return NextResponse.json({
      success: true,
      data: { id, read },
    });
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
      { status: 500 },
    );
  }
}
