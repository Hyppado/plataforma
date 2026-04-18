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
  {
    table: "Setting",
    group: "general",
    masked: false,
    rowFilter: "key = 'exchange.usd_brl'",
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
