/**
 * scripts/sync-db.ts — CLI wrapper for prod→preview database sync
 *
 * All sync logic, masking, and table definitions live in lib/sync/.
 * This script provides CLI argument parsing and a human-readable summary.
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

import { randomUUID } from "crypto";
import { runSync, type SyncSummary } from "../lib/sync/service";
import type { Logger, LogLevel } from "../lib/logger";

// ---------------------------------------------------------------------------
// Standalone logger (mirrors lib/logger.ts — can't use @/ alias in scripts)
// ---------------------------------------------------------------------------

interface LogMeta {
  [key: string]: unknown;
}

function createScriptLogger(): Logger {
  const cid = randomUUID().slice(0, 8);

  function emit(level: LogLevel, msg: string, meta?: LogMeta): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      source: "sync-db",
      correlationId: cid,
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

  const logger: Logger = {
    debug: (msg, meta) => emit("debug", msg, meta),
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
    child: () => logger, // scripts don't need real child loggers
    correlationId: cid,
  };

  return logger;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  dryRun: boolean;
  tableGroups: string[] | null;
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
// Pretty summary (CLI only)
// ---------------------------------------------------------------------------

function printSummary(summary: SyncSummary): void {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(
    `║  Sync ${summary.dryRun ? "(DRY-RUN) " : ""}completed                      ║`,
  );
  console.log("╠══════════════════════════════════════════╣");
  console.log(
    `║  Tables synced:  ${String(summary.tablesSynced).padStart(4)}                     ║`,
  );
  console.log(
    `║  Tables failed:  ${String(summary.tablesFailed).padStart(4)}                     ║`,
  );
  console.log(
    `║  Total rows:     ${String(summary.totalRows.toLocaleString("pt-BR")).padStart(10)}               ║`,
  );
  console.log(
    `║  PII masked:     ${summary.maskedTables.length > 0 ? "yes" : "no "}                      ║`,
  );
  console.log(
    `║  Duration:       ${String(summary.durationMs).padStart(6)} ms               ║`,
  );
  console.log("╚══════════════════════════════════════════╝\n");

  if (summary.failedTables.length > 0) {
    console.log("  ⚠ Failed tables:");
    for (const t of summary.failedTables) {
      console.log(`    ${t}`);
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, tableGroups } = parseArgs();
  const logger = createScriptLogger();

  const summary = await runSync({
    dryRun,
    tableGroups,
    logger,
  });

  printSummary(summary);

  if (summary.tablesFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    source: "sync-db",
    msg: "Unhandled error",
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }));
  process.exit(1);
});
