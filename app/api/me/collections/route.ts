import { NextRequest, NextResponse } from "next/server";
import type { CollectionDTO } from "@/lib/types/dto";

// Mock collections (in production, use Prisma)
const mockCollections: CollectionDTO[] = [
  {
    id: "col-1",
    name: "Produtos para testar",
    itemCount: 8,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "col-2",
    name: "Vídeos virais",
    itemCount: 15,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "col-3",
    name: "Skincare trending",
    itemCount: 6,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "col-4",
    name: "Tech reviews",
    itemCount: 12,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "col-5",
    name: "Alta conversão",
    itemCount: 4,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    const limitedCollections = mockCollections.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: limitedCollections,
        total: mockCollections.length,
      },
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch collections" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Collection name is required" },
        { status: 400 },
      );
    }

    // In production, create in Prisma
    const newCollection: CollectionDTO = {
      id: `col-${Date.now()}`,
      name,
      itemCount: 0,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: newCollection,
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create collection" },
      { status: 500 },
    );
  }
}
