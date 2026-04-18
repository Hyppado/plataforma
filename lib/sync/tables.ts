/**
 * lib/sync/tables.ts — Table group definitions for prod→preview DB sync
 *
 * Defines which tables to sync, their group membership, and masking flags.
 * Used by both the Vercel cron route (lib/sync/service.ts) and the CLI
 * script (scripts/sync-db.ts).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableDef {
  /** PostgreSQL table name (Prisma model name — quoted in queries) */
  table: string;
  /** Group for filtering (echotik, billing, users, access, usage) */
  group: string;
  /** Whether rows need PII masking */
  masked: boolean;
  /** Columns to force to NULL */
  nullColumns?: string[];
}

// ---------------------------------------------------------------------------
// Table definitions — FK-safe order (parents before children)
// ---------------------------------------------------------------------------

export const TABLE_DEFS: TableDef[] = [
  // ── Echotik / as-is group ──────────────────────────────────────────────
  { table: "Region", group: "echotik", masked: false },
  { table: "EchotikCategory", group: "echotik", masked: false },
  { table: "IngestionRun", group: "echotik", masked: false },
  { table: "EchotikVideoTrendDaily", group: "echotik", masked: false },
  { table: "EchotikProductTrendDaily", group: "echotik", masked: false },
  { table: "EchotikCreatorTrendDaily", group: "echotik", masked: false },
  { table: "EchotikProductDetail", group: "echotik", masked: false },
  { table: "EchotikRawResponse", group: "echotik", masked: false },

  // ── Plans / billing (no PII in these) ──────────────────────────────────
  { table: "Plan", group: "billing", masked: false },

  // ── Users (masked) ────────────────────────────────────────────────────
  {
    table: "User",
    group: "users",
    masked: true,
    nullColumns: ["image"],
  },

  // ── External account links (masked) ───────────────────────────────────
  { table: "ExternalAccountLink", group: "users", masked: true },

  // ── Consent (masked) ──────────────────────────────────────────────────
  { table: "ConsentRecord", group: "users", masked: true },

  // ── Erasure requests ──────────────────────────────────────────────────
  { table: "DataErasureRequest", group: "users", masked: false },

  // ── Subscriptions ─────────────────────────────────────────────────────
  { table: "Subscription", group: "billing", masked: false },
  { table: "HotmartSubscription", group: "billing", masked: true },
  { table: "SubscriptionCharge", group: "billing", masked: false },

  // ── Access ────────────────────────────────────────────────────────────
  { table: "AccessGrant", group: "access", masked: false },
  { table: "Invitation", group: "access", masked: true },

  // ── Usage ─────────────────────────────────────────────────────────────
  { table: "UsagePeriod", group: "usage", masked: false },
  { table: "UsageEvent", group: "usage", masked: false },

  // ── General settings (includes exchange.usd_brl and other app config) ─
  { table: "Setting", group: "general", masked: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All distinct group names */
export function getAllGroups(): string[] {
  return Array.from(new Set(TABLE_DEFS.map((d) => d.group)));
}

/** Filter tables by selected groups */
export function getTablesForGroups(groups: string[]): TableDef[] {
  return TABLE_DEFS.filter((d) => groups.includes(d.group));
}
