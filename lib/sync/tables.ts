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
  /** Group for filtering (echotik, general) */
  group: string;
  /** Whether rows need PII masking */
  masked: boolean;
  /** Columns to force to NULL */
  nullColumns?: string[];
  /** Optional SQL WHERE clause (no "WHERE" keyword) to filter rows on SELECT */
  rowFilter?: string;
  /**
   * When set, the sync uses INSERT … ON CONFLICT (upsertKey) DO UPDATE instead
   * of TRUNCATE/DELETE + INSERT. Requires rowFilter to also be set.
   * Use for tables where we must NEVER delete rows we don't intend to touch
   * (e.g. Setting, where preview keeps its own Hotmart/API credentials).
   */
  upsertKey?: string;
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

  // ── General settings — only sync exchange rate; all other settings stay in prod ─
  // upsertKey: never DELETE from Setting — use ON CONFLICT to update in place.
  // This guarantees that preview's Hotmart credentials, API keys, and other
  // admin secrets are NEVER wiped by the daily sync, even in edge cases.
  {
    table: "Setting",
    group: "general",
    masked: false,
    rowFilter: "key = 'exchange.usd_brl'",
    upsertKey: "key",
  },
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
