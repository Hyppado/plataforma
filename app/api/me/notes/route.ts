import { NextRequest, NextResponse } from "next/server";
import type { NoteDTO } from "@/lib/types/dto";

// Mock notes (in production, use Prisma)
const mockNotes: NoteDTO[] = [
  {
    id: "note-1",
    type: "video",
    externalId: "vid-0-como-usar-o-produto",
    content:
      "Boa estrutura de hook nos primeiros 3s. Testar com produto similar.",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "note-2",
    type: "product",
    externalId: "prod-0-serum-vitamina-c",
    content: "Margem boa. Verificar fornecedor nacional. Preço competitivo.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "note-3",
    type: "creator",
    externalId: "creator-0-mariabela",
    content: "Engajamento alto. Considerar para parceria. Taxa ~15%.",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "note-4",
    type: "video",
    externalId: "vid-3-antes-e-depois",
    content: "Formato UGC funciona bem. Criar versão com nosso produto.",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "note-5",
    type: "product",
    externalId: "prod-1-fone-bluetooth",
    content: "Categoria saturada. Focar em diferenciais. Unboxing experience.",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);
    const type = searchParams.get("type") || undefined;
    const externalId = searchParams.get("externalId") || undefined;

    let notes = [...mockNotes];

    if (type) {
      notes = notes.filter((note) => note.type === type);
    }

    if (externalId) {
      notes = notes.filter((note) => note.externalId === externalId);
    }

    const limitedNotes = notes.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items: limitedNotes,
        total: notes.length,
      },
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, externalId, content } = body;

    if (!type || !externalId || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // In production, create in Prisma
    const newNote: NoteDTO = {
      id: `note-${Date.now()}`,
      type,
      externalId,
      content,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: newNote,
    });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create note" },
      { status: 500 },
    );
  }
}
