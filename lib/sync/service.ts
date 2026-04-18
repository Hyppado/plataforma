/**
 * lib/sync/service.ts — Prod→preview database sync service
 *
 * Environment variables:
 *   DATABASE_URL            — production database (source) — already set by Vercel
 *   PREVIEW_DATABASE_URL    — preview/dev database (target) — set in Vercel prod env
 *
 * For CLI usage (scripts/sync-db.ts):
 *   PROD_DATABASE_URL       — overrides the source if set (backwards compat)
 *   DATABASE_URL             — falls back to source if PROD_DATABASE_URL is unset
 *   PREVIEW_DATABASE_URL    — target database
 *
 * ⚠️  NEVER commit database URLs to any file — configure them only in
 *     Vercel environment variables or as shell exports.
 *
 * This module is used by:
 *   - app/api/cron/sync-db/route.ts  (Vercel Cron — daily at 06:00 UTC)
 *   - scripts/sync-db.ts             (CLI for manual runs)
 */

import { Client, type QueryResult } from "pg";
import { maskRow, applyNullColumns } from "./masking";
import { TABLE_DEFS, getAllGroups, getTablesForGroups } from "./tables";
import type { TableDef } from "./tables";
import type { Logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Only log what would happen — do not write to preview */
  dryRun?: boolean;
  /** Restrict sync to these table groups (null = all) */
  tableGroups?: string[] | null;
  /** Logger instance (from cron or CLI) */
  logger: Logger;
}

export interface SyncTableResult {
  table: string;
  rows: number;
  masked: boolean;
  /** -1 = failed */
  error?: string;
}

export interface SyncSummary {
  dryRun: boolean;
  tablesTotal: number;
  tablesSynced: number;
  tablesFailed: number;
  totalRows: number;
  maskedTables: string[];
  failedTables: string[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 2000;

/**
 * Prepare a value for parameterised insertion.
 * The `pg` driver deserialises JSON/JSONB columns into JS objects/arrays on
 * SELECT, but PostgreSQL expects a JSON **string** when inserting via $N
 * parameters.  Re-serialise any plain object or array so the INSERT succeeds.
 */
function prepareValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

/**
 * Build a parameterised INSERT statement for a batch of rows.
 * Returns { sql, values } ready for client.query().
 */
function buildInsert(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const rowPlaceholders: string[] = [];

  for (const row of rows) {
    const placeholders: string[] = [];
    for (const col of columns) {
      values.push(prepareValue(row[col]));
      placeholders.push(`$${values.length}`);
    }
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
  }

  const quotedCols = columns.map((c) => `"${c}"`).join(", ");
  const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES ${rowPlaceholders.join(", ")}`;
  return { sql, values };
}

// ---------------------------------------------------------------------------
// Single-table sync
// ---------------------------------------------------------------------------

async function syncTable(
  prod: Client,
  preview: Client,
  def: TableDef,
  dryRun: boolean,
  log: Logger,
): Promise<SyncTableResult> {
  const { table, masked, nullColumns } = def;

  // Read rows from production (apply optional filter)
  const whereClause = def.rowFilter ? ` WHERE ${def.rowFilter}` : "";
  const readRes: QueryResult = await prod.query(
    `SELECT * FROM "${table}"${whereClause} ORDER BY 1`,
  );
  const totalRows = readRes.rows.length;

  if (totalRows === 0) {
    log.info(`${table}: 0 rows in production — skipping`, { table });
    return { table, rows: 0, masked };
  }

  if (dryRun) {
    log.info(`[DRY-RUN] ${table}: would sync ${totalRows} rows`, {
      table,
      rows: totalRows,
      masked,
    });
    return { table, rows: totalRows, masked };
  }

  // Determine columns from the first row
  const columns = Object.keys(readRes.rows[0]);

  // Apply masking if needed
  let rows = readRes.rows as Record<string, unknown>[];
  if (masked) {
    if (table === "User") {
      // Only mask users that came from a subscription — preserve admins
      // and manually created accounts so they can log in on preview
      const subRes = await prod.query(
        'SELECT DISTINCT "userId" FROM "Subscription"',
      );
      const subscriberIds = new Set(subRes.rows.map((r) => r.userId as string));
      rows = rows.map((row) =>
        subscriberIds.has(row.id as string)
          ? maskRow(table, { ...row })
          : { ...row },
      );
    } else {
      rows = rows.map((row) => maskRow(table, { ...row }));
    }
  }

  // Null out columns if needed
  if (nullColumns && nullColumns.length > 0) {
    rows = rows.map((row) => applyNullColumns(row, nullColumns));
  }

  // Write to preview inside a transaction per table:
  // TRUNCATE CASCADE + batched INSERTs
  await preview.query("BEGIN");
  try {
    await preview.query(`TRUNCATE "${table}" CASCADE`);

    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rows.slice(offset, offset + BATCH_SIZE);
      const { sql, values } = buildInsert(table, columns, batch);
      await preview.query(sql, values);
    }

    await preview.query("COMMIT");
    log.info(`${table}: synced ${totalRows} rows`, {
      table,
      rows: totalRows,
      masked,
    });
  } catch (err) {
    await preview.query("ROLLBACK");
    throw err;
  }

  return { table, rows: totalRows, masked };
}

// ---------------------------------------------------------------------------
// Main sync entrypoint
// ---------------------------------------------------------------------------

/**
 * Run the full prod→preview database sync.
 *
 * Connects to both databases, iterates through table definitions in FK-safe
 * order, applies masking where configured, and returns a summary.
 */
export async function runSync(options: SyncOptions): Promise<SyncSummary> {
  const { dryRun = false, tableGroups = null, logger: log } = options;
  const startMs = Date.now();

  // Validate env
  // Source: PROD_DATABASE_URL (CLI) or DATABASE_URL (Vercel prod)
  const prodUrl = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
  // Target: always PREVIEW_DATABASE_URL
  const previewUrl = process.env.PREVIEW_DATABASE_URL;

  if (!prodUrl) {
    throw new Error(
      "Neither PROD_DATABASE_URL nor DATABASE_URL is set — cannot connect to production",
    );
  }
  if (!previewUrl) {
    throw new Error(
      "PREVIEW_DATABASE_URL is not set — cannot connect to preview",
    );
  }

  // Determine which tables to sync
  const allGroups = getAllGroups();
  const selectedGroups = tableGroups ?? allGroups;
  const invalidGroups = selectedGroups.filter((g) => !allGroups.includes(g));
  if (invalidGroups.length > 0) {
    throw new Error(
      `Unknown table groups: ${invalidGroups.join(", ")}. Valid: ${allGroups.join(", ")}`,
    );
  }

  const tablesToSync = getTablesForGroups(selectedGroups);

  log.info("Starting database sync", {
    dryRun,
    groups: selectedGroups,
    tables: tablesToSync.map((t) => t.table),
  });

  // Connect to both databases
  // Explicit ssl config silences the pg v8 deprecation warning.
  // We also strip sslmode from the URL so pg-connection-string doesn't
  // emit its own warning — ssl is fully governed by the object below.
  const stripSslMode = (rawUrl: string): string => {
    try {
      const u = new URL(rawUrl);
      u.searchParams.delete("sslmode");
      return u.toString();
    } catch {
      return rawUrl;
    }
  };
  const ssl = { rejectUnauthorized: true };
  const prod = new Client({ connectionString: stripSslMode(prodUrl), ssl });
  const preview = new Client({
    connectionString: stripSslMode(previewUrl),
    ssl,
  });

  try {
    await prod.connect();
    log.info("Connected to production database");
    await preview.connect();
    log.info("Connected to preview database");

    // Safety check: prevent syncing to itself
    if (prodUrl === previewUrl) {
      throw new Error(
        "PROD_DATABASE_URL and DATABASE_URL are identical — aborting to prevent data loss",
      );
    }

    // Sync tables in FK-safe order
    const results: SyncTableResult[] = [];

    for (const def of tablesToSync) {
      try {
        const result = await syncTable(prod, preview, def, dryRun, log);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Failed to sync ${def.table}`, {
          table: def.table,
          error: message,
        });
        results.push({
          table: def.table,
          rows: -1,
          masked: def.masked,
          error: message,
        });
      }
    }

    // Build summary
    const synced = results.filter((r) => r.rows >= 0);
    const failed = results.filter((r) => r.rows < 0);
    const totalRows = synced.reduce((sum, r) => sum + r.rows, 0);
    const maskedTables = synced.filter((r) => r.masked).map((r) => r.table);
    const durationMs = Date.now() - startMs;

    const summary: SyncSummary = {
      dryRun,
      tablesTotal: results.length,
      tablesSynced: synced.length,
      tablesFailed: failed.length,
      totalRows,
      maskedTables,
      failedTables: failed.map((f) => f.table),
      durationMs,
    };

    log.info("Sync complete", {
      dryRun: summary.dryRun,
      tablesTotal: summary.tablesTotal,
      tablesSynced: summary.tablesSynced,
      tablesFailed: summary.tablesFailed,
      totalRows: summary.totalRows,
      maskedTables: summary.maskedTables,
      failedTables: summary.failedTables,
      durationMs: summary.durationMs,
    });

    return summary;
  } finally {
    await prod.end().catch(() => {});
    await preview.end().catch(() => {});
  }
}
