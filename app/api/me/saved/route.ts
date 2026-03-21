import { NextRequest, NextResponse } from "next/server";
import type { SavedItemDTO } from "@/lib/types/dto";

// Mock saved items (in production, use Prisma)
const mockSavedItems: SavedItemDTO[] = [
  {
    id: "saved-1",
    type: "video",
    externalId: "vid-0-como-usar-o-produto",
    title: "Como usar o produto X em 5 passos",
    meta: { creator: "@mariabela", revenue: 245000 },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "saved-2",
    type: "product",
    externalId: "prod-0-serum-vitamina-c",
    title: "Sérum Vitamina C 30ml",
    meta: { category: "Skincare", sales: 45200 },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "saved-3",
    type: "video",
    externalId: "vid-3-antes-e-depois",
    title: "ANTES E DEPOIS impressionante",
    meta: { creator: "@pedrosaude", revenue: 142000 },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "saved-4",
    type: "product",
    externalId: "prod-1-fone-bluetooth",
    title: "Fone Bluetooth Pro Max",
    meta: { category: "Eletrônicos", sales: 38700 },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "saved-5",
    type: "video",
    externalId: "vid-6-comparativo",
    title: "Comparativo: produto A vs B",
    meta: { creator: "@techreview", revenue: 87000 },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const type = searchParams.get("type") || undefined; // 'video' | 'product'

    let items = [...mockSavedItems];

    if (type) {
      items = items.filter((item) => item.type === type);
    }

    const limitedItems = items.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: limitedItems,
        total: items.length,
      },
    });
  } catch (error) {
    console.error("Error fetching saved items:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, externalId, title, meta } = body;

    if (!type || !externalId || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // In production, save to Prisma
    const newItem: SavedItemDTO = {
      id: `saved-${Date.now()}`,
      type,
      externalId,
      title,
      meta,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: newItem,
    });
  } catch (error) {
    console.error("Error saving item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save item" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing item ID" },
        { status: 400 },
      );
    }

    // In production, delete from Prisma
    return NextResponse.json({
      success: true,
      data: { deleted: id },
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
