/**
 * scripts/sync-db.ts — Sync production data to preview database
 *
 * Copies Echotik trending data (as-is) and user/billing data (with PII masking)
 * from the production Neon database to the preview environment database.
 *
 * Environment variables:
 *   PROD_DATABASE_URL  — read-only connection string to production Neon DB
 *   DATABASE_URL       — pooled connection to the preview Neon DB (already in .env)
 *
 * ⚠️  NEVER commit PROD_DATABASE_URL to any file — use it only as a shell export
 *     or a secrets manager at runtime.
 *
 * Usage:
 *   npx tsx scripts/sync-db.ts                          # full sync
 *   npx tsx scripts/sync-db.ts --dry-run                # preview only
 *   npx tsx scripts/sync-db.ts --tables=echotik,plans   # sync specific groups
 *
 * Table groups for --tables filter:
 *   echotik      Region, EchotikCategory, Echotik*TrendDaily, EchotikProductDetail,
 *                EchotikRawResponse, IngestionRun
 *   users        User, ExternalAccountLink, ConsentRecord, DataErasureRequest
 *   billing      Subscription, HotmartSubscription, SubscriptionCharge,
 *                Plan, PlanExternalMapping, Coupon
 *   access       AccessGrant, Invitation
 *   usage        UsagePeriod, UsageEvent
 */

import { Client, type QueryResult } from "pg";
import { createHash, randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Logger (mirrors lib/logger.ts pattern — standalone for scripts)
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

const correlationId = randomUUID().slice(0, 8);

function log(level: LogLevel, msg: string, meta?: LogMeta): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    source: "sync-db",
    correlationId,
    msg,
    ...meta,
  };
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// Masking helpers (deterministic — same input ⇒ same output)
// ---------------------------------------------------------------------------

function deterministicHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a deterministic fake email from a seed value.
 * Output format: user_<shortHash>@preview.hyppado.test
 * The .test TLD is reserved (RFC 2606) and will never resolve.
 */
function fakeEmail(seed: string): string {
  const hash = deterministicHash(seed).slice(0, 12);
  return `user_${hash}@preview.hyppado.test`;
}

/**
 * Generate a deterministic fake name from a seed value.
 * Uses a pool of generic first/last names to build plausible output.
 */
function fakeName(seed: string): string {
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

  const hash = deterministicHash(seed);
  const firstIdx = parseInt(hash.slice(0, 4), 16) % FIRST_NAMES.length;
  const lastIdx = parseInt(hash.slice(4, 8), 16) % LAST_NAMES.length;
  return `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`;
}

// ---------------------------------------------------------------------------
// Table definitions — order matters for FK constraints
// ---------------------------------------------------------------------------

/**
 * Prisma model names → actual PostgreSQL table names.
 * Prisma uses the model name as the table name by default (case-sensitive
 * with quoting). We quote all table names to be safe.
 */

interface TableDef {
  /** PostgreSQL table name (quoted in queries) */
  table: string;
  /** Group for --tables filter */
  group: string;
  /** Whether rows need PII masking */
  masked: boolean;
  /**
   * Column-level masking transform.
   * Keys are column names; values are SQL expressions that reference
   * the source column via "val" placeholder (replaced at query time).
   * Only used when masked=true.
   */
  maskColumns?: Record<string, string>;
  /**
   * Columns to force to NULL. Simpler than maskColumns for blanking.
   */
  nullColumns?: string[];
}

// Tables listed in FK-safe order (parents before children)
const TABLE_DEFS: TableDef[] = [
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
  { table: "PlanExternalMapping", group: "billing", masked: false },
  { table: "Coupon", group: "billing", masked: false },

  // ── Users (masked) ────────────────────────────────────────────────────
  {
    table: "User",
    group: "users",
    masked: true,
    // name and email are masked in-code (need seed from 'id');
    // image is nulled
    nullColumns: ["image"],
  },

  // ── External account links (masked) ───────────────────────────────────
  {
    table: "ExternalAccountLink",
    group: "users",
    masked: true,
    // externalCustomerId, externalReference, externalEmail masked in-code
  },

  // ── Consent (masked) ──────────────────────────────────────────────────
  {
    table: "ConsentRecord",
    group: "users",
    masked: true,
    // ipAddress → '0.0.0.0' in-code
  },

  // ── Erasure requests ──────────────────────────────────────────────────
  { table: "DataErasureRequest", group: "users", masked: false },

  // ── Subscriptions ─────────────────────────────────────────────────────
  { table: "Subscription", group: "billing", masked: false },
  {
    table: "HotmartSubscription",
    group: "billing",
    masked: true,
    // subscriberCode, buyerEmail masked in-code
  },
  { table: "SubscriptionCharge", group: "billing", masked: false },

  // ── Access ────────────────────────────────────────────────────────────
  { table: "AccessGrant", group: "access", masked: false },
  {
    table: "Invitation",
    group: "access",
    masked: true,
    // email, token masked in-code
  },

  // ── Usage ─────────────────────────────────────────────────────────────
  { table: "UsagePeriod", group: "usage", masked: false },
  { table: "UsageEvent", group: "usage", masked: false },
];

// ---------------------------------------------------------------------------
// In-process row masking
// ---------------------------------------------------------------------------

/**
 * Apply masking transforms to a single row (JS object).
 * Mutates the row in-place and returns it.
 */
function maskRow(
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
      if (row.externalEmail)
        row.externalEmail = fakeEmail(`ext:${row.userId}`);
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

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  dryRun: boolean;
  tableGroups: string[] | null; // null = all groups
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let dryRun = false;
  let tableGroups: string[] | null = null;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--tables=")) {
      tableGroups = arg
        .slice("--tables=".length)
        .split(",")
        .map((g) => g.trim().toLowerCase());
    }
  }

  return { dryRun, tableGroups };
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 2000;

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
      values.push(row[col] ?? null);
      placeholders.push(`$${values.length}`);
    }
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
  }

  const quotedCols = columns.map((c) => `"${c}"`).join(", ");
  const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES ${rowPlaceholders.join(", ")}`;
  return { sql, values };
}

/**
 * Count rows in a table.
 */
async function countRows(client: Client, table: string): Promise<number> {
  const res: QueryResult = await client.query(
    `SELECT count(*)::int AS cnt FROM "${table}"`,
  );
  return res.rows[0].cnt;
}

// ---------------------------------------------------------------------------
// Main sync logic
// ---------------------------------------------------------------------------

async function syncTable(
  prod: Client,
  preview: Client,
  def: TableDef,
  dryRun: boolean,
): Promise<{ table: string; rows: number; masked: boolean }> {
  const { table, masked, nullColumns } = def;

  // Read all rows from production
  const readRes: QueryResult = await prod.query(
    `SELECT * FROM "${table}" ORDER BY 1`,
  );
  const totalRows = readRes.rows.length;

  if (totalRows === 0) {
    log("info", `${table}: 0 rows in production — skipping`, { table });
    return { table, rows: 0, masked };
  }

  if (dryRun) {
    log("info", `[DRY-RUN] ${table}: would sync ${totalRows} rows`, {
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
    rows = rows.map((row) => maskRow(table, { ...row }));
  }

  // Null out columns if needed
  if (nullColumns && nullColumns.length > 0) {
    rows = rows.map((row) => {
      for (const col of nullColumns) {
        if (col in row) row[col] = null;
      }
      return row;
    });
  }

  // Write to preview inside a transaction per table:
  // TRUNCATE CASCADE + batched INSERTs
  await preview.query("BEGIN");
  try {
    await preview.query(`TRUNCATE "${table}" CASCADE`);

    // Insert in batches
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rows.slice(offset, offset + BATCH_SIZE);
      const { sql, values } = buildInsert(table, columns, batch);
      await preview.query(sql, values);
    }

    await preview.query("COMMIT");
    log("info", `${table}: synced ${totalRows} rows`, {
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
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, tableGroups } = parseArgs();

  // Validate env
  const prodUrl = process.env.PROD_DATABASE_URL;
  const previewUrl = process.env.DATABASE_URL;

  if (!prodUrl) {
    log("error", "PROD_DATABASE_URL is not set — cannot connect to production");
    process.exit(1);
  }
  if (!previewUrl) {
    log("error", "DATABASE_URL is not set — cannot connect to preview");
    process.exit(1);
  }

  // Determine which tables to sync
  const allGroups = Array.from(new Set(TABLE_DEFS.map((d) => d.group)));
  const selectedGroups = tableGroups ?? allGroups;
  const invalidGroups = selectedGroups.filter((g) => !allGroups.includes(g));
  if (invalidGroups.length > 0) {
    log("error", `Unknown table groups: ${invalidGroups.join(", ")}`, {
      validGroups: allGroups,
    });
    process.exit(1);
  }

  const tablesToSync = TABLE_DEFS.filter((d) =>
    selectedGroups.includes(d.group),
  );

  log("info", "Starting database sync", {
    dryRun,
    groups: selectedGroups,
    tables: tablesToSync.map((t) => t.table),
  });

  // Connect to both databases
  const prod = new Client({ connectionString: prodUrl });
  const preview = new Client({ connectionString: previewUrl });

  try {
    await prod.connect();
    log("info", "Connected to production database");
    await preview.connect();
    log("info", "Connected to preview database");

    // Safety check: verify preview is NOT the production database
    const prodDbRes = await prod.query("SELECT current_database()");
    const previewDbRes = await preview.query("SELECT current_database()");
    const prodDb = prodDbRes.rows[0].current_database;
    const previewDb = previewDbRes.rows[0].current_database;

    if (prodUrl === previewUrl) {
      log("error", "PROD_DATABASE_URL and DATABASE_URL point to the same connection string — aborting to prevent data loss");
      process.exit(1);
    }

    log("info", "Database targets", {
      production: prodDb,
      preview: previewDb,
    });

    // Sync tables in order
    const results: { table: string; rows: number; masked: boolean }[] = [];

    for (const def of tablesToSync) {
      try {
        const result = await syncTable(prod, preview, def, dryRun);
        results.push(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        log("error", `Failed to sync ${def.table}`, {
          table: def.table,
          error: message,
        });
        // Continue with remaining tables
        results.push({ table: def.table, rows: -1, masked: def.masked });
      }
    }

    // Summary
    const synced = results.filter((r) => r.rows >= 0);
    const failed = results.filter((r) => r.rows < 0);
    const totalRows = synced.reduce((sum, r) => sum + r.rows, 0);
    const maskedTables = synced.filter((r) => r.masked).map((r) => r.table);

    log("info", "═══ Sync complete ═══", {
      dryRun,
      tablesTotal: results.length,
      tablesSynced: synced.length,
      tablesFailed: failed.length,
      totalRows,
      maskedTables,
      failedTables: failed.map((f) => f.table),
    });

    // Human-readable summary
    console.log("\n╔══════════════════════════════════════════╗");
    console.log(
      `║  Sync ${dryRun ? "(DRY-RUN) " : ""}completed                      ║`,
    );
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Tables synced:  ${String(synced.length).padStart(4)}                     ║`);
    console.log(`║  Tables failed:  ${String(failed.length).padStart(4)}                     ║`);
    console.log(
      `║  Total rows:     ${String(totalRows.toLocaleString("pt-BR")).padStart(10)}               ║`,
    );
    console.log(`║  PII masked:     ${maskedTables.length > 0 ? "yes" : "no "}                      ║`);
    console.log("╚══════════════════════════════════════════╝");

    if (synced.length > 0) {
      console.log("\n  Table breakdown:");
      for (const r of synced) {
        const flag = r.masked ? " 🔒" : "";
        console.log(
          `    ${r.table.padEnd(28)} ${String(r.rows).padStart(8)} rows${flag}`,
        );
      }
    }
    if (failed.length > 0) {
      console.log("\n  ⚠ Failed tables:");
      for (const f of failed) {
        console.log(`    ${f.table}`);
      }
    }
    console.log("");

    if (failed.length > 0) {
      process.exit(1);
    }
  } finally {
    await prod.end().catch(() => {});
    await preview.end().catch(() => {});
  }
}

main().catch((err) => {
  log("error", "Unhandled error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
