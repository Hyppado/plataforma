/**
 * app/api/avatar-video/creations/[id]/edit-prompt/route.ts
 *
 * PATCH /api/avatar-video/creations/:id/edit-prompt
 *
 * Saves a user-edited version of the generated VEO 3 JSON prompt.
 * Allowed only when status is PROMPT_READY.
 *
 * Body: { promptText: string, promptJson?: unknown }
 *   - promptText: the raw text representation (may be the full JSON string
 *     when the user is editing the JSON directly, or extracted prompt field)
 *   - promptJson: the parsed JSON object when the edited content is valid JSON
 *
 * Response: { creation: CreationDTO }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { saveEditedPrompt } from "@/lib/avatar-video/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido no corpo da requisição." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).promptText !== "string"
  ) {
    return NextResponse.json(
      { error: "Campo obrigatório: promptText (string)." },
      { status: 400 },
    );
  }

  const { promptText, promptJson } = body as {
    promptText: string;
    promptJson?: unknown;
  };

  try {
    const result = await saveEditedPrompt(
      auth.userId,
      creationId,
      promptText,
      promptJson,
    );

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        forbidden: 403,
        invalid_state: 409,
        internal: 500,
      };
      const status = statusMap[result.code] ?? 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ creation: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
