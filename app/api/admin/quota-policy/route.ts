/**
 * app/api/admin/quota-policy/route.ts
 *
 * GET  — read current quota policy from DB (falls back to defaults)
 * PUT  — update quota policy in DB
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import { getQuotaPolicyFromDB, saveQuotaPolicyToDB } from "@/lib/admin/config";
import type { QuotaPolicy } from "@/lib/types/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/admin/quota-policy");

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const policy = await getQuotaPolicyFromDB();
    return NextResponse.json(policy);
  } catch (error) {
    log.error("GET failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to load quota policy" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as Partial<QuotaPolicy>;

    // Validate required numeric fields
    const requiredFields: (keyof QuotaPolicy)[] = [
      "transcriptsPerMonth",
      "scriptsPerMonth",
      "insightTokensPerMonth",
      "scriptTokensPerMonth",
      "insightMaxOutputTokens",
      "scriptMaxOutputTokens",
    ];

    for (const field of requiredFields) {
      if (body[field] !== undefined && typeof body[field] !== "number") {
        return NextResponse.json(
          { error: `${field} must be a number` },
          { status: 400 },
        );
      }
    }

    // Merge with current to allow partial updates
    const current = await getQuotaPolicyFromDB();
    const updated: QuotaPolicy = { ...current, ...body };

    await saveQuotaPolicyToDB(updated);
    return NextResponse.json(updated);
  } catch (error) {
    log.error("PUT failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to save quota policy" },
      { status: 500 },
    );
  }
}
