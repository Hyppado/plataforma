/**
 * lib/sync/masking.ts — Pure masking functions for prod→preview DB sync
 *
 * Deterministic: same input always produces the same masked output,
 * preserving referential integrity across foreign keys.
 *
 * Used by both the Vercel cron service (lib/sync/service.ts) and the
 * CLI script (scripts/sync-db.ts).
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Deterministic SHA-256 hex hash of a string */
export function deterministicHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a deterministic fake email from a seed value.
 * Output format: user_<shortHash>@preview.hyppado.test
 * The .test TLD is reserved (RFC 2606) and will never resolve.
 */
export function fakeEmail(seed: string): string {
  const hash = deterministicHash(seed).slice(0, 12);
  return `user_${hash}@preview.hyppado.test`;
}

const FIRST_NAMES = [
  "Ana",
  "Carlos",
  "Mariana",
  "Pedro",
  "Julia",
  "Lucas",
  "Fernanda",
  "Rafael",
  "Beatriz",
  "Gabriel",
  "Camila",
  "Diego",
  "Larissa",
  "Thiago",
  "Isabella",
  "Mateus",
  "Leticia",
  "Bruno",
  "Amanda",
  "Felipe",
];

const LAST_NAMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Lima",
  "Pereira",
  "Costa",
  "Rodrigues",
  "Almeida",
  "Nascimento",
  "Ferreira",
  "Araújo",
  "Melo",
  "Barbosa",
  "Ribeiro",
  "Carvalho",
  "Gomes",
  "Martins",
  "Rocha",
  "Vieira",
];

/**
 * Generate a deterministic fake name from a seed value.
 * Uses a pool of generic first/last names to build plausible output.
 */
export function fakeName(seed: string): string {
  const hash = deterministicHash(seed);
  const firstIdx = parseInt(hash.slice(0, 4), 16) % FIRST_NAMES.length;
  const lastIdx = parseInt(hash.slice(4, 8), 16) % LAST_NAMES.length;
  return `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`;
}

// ---------------------------------------------------------------------------
// Row-level masking
// ---------------------------------------------------------------------------

/**
 * Apply masking transforms to a single row (JS object).
 * Mutates the row in-place and returns it.
 */
export function maskRow(
  tableName: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  switch (tableName) {
    case "User": {
      const id = String(row.id);
      row.name = fakeName(id);
      row.email = fakeEmail(id);
      row.image = null;
      // passwordHash stays (bcrypt, not reversible)
      // role, status, deletedAt stay as-is
      break;
    }

    case "ExternalAccountLink": {
      const id = String(row.id);
      if (row.externalCustomerId)
        row.externalCustomerId = deterministicHash(id).slice(0, 32);
      if (row.externalReference)
        row.externalReference = deterministicHash(`ref:${id}`).slice(0, 32);
      if (row.externalEmail) row.externalEmail = fakeEmail(`ext:${row.userId}`);
      break;
    }

    case "ConsentRecord": {
      row.ipAddress = "0.0.0.0";
      break;
    }

    case "HotmartSubscription": {
      const id = String(row.id);
      if (row.subscriberCode)
        row.subscriberCode = deterministicHash(id).slice(0, 32);
      if (row.buyerEmail)
        row.buyerEmail = fakeEmail(`hotmart:${row.subscriptionId}`);
      // hotmartSubscriptionId stays (needed for uniqueness + FK logic)
      break;
    }

    case "Invitation": {
      const id = String(row.id);
      row.email = fakeEmail(`invite:${id}`);
      row.token = deterministicHash(id).slice(0, 48);
      break;
    }
  }

  return row;
}

/**
 * Apply null-column blanking to a row. Mutates in-place.
 */
export function applyNullColumns(
  row: Record<string, unknown>,
  nullColumns: string[],
): Record<string, unknown> {
  for (const col of nullColumns) {
    if (col in row) row[col] = null;
  }
  return row;
}
