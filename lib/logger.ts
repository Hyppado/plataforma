/**
 * lib/logger.ts — Structured logger with correlation IDs
 *
 * Provides JSON-formatted log output (in production) or readable
 * prefixed output (in development) with automatic correlation tracking.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("echotik-cron");
 *   log.info("Sync started", { region: "BR" });
 *   // → {"ts":"...","level":"info","source":"echotik-cron","correlationId":"abc","msg":"Sync started","region":"BR"}
 *
 *   const child = log.child({ runId: "xyz" });
 *   child.info("Step done");
 *   // → inherits correlationId + adds runId to every message
 */

import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void;
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
  /** Create a child logger that inherits source + extra context */
  child(extra: LogMeta): Logger;
  /** The correlation ID of this logger instance */
  readonly correlationId: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const IS_JSON =
  process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatLog(
  level: LogLevel,
  source: string,
  correlationId: string,
  msg: string,
  baseMeta: LogMeta,
  extra?: LogMeta,
): string {
  if (IS_JSON) {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level,
      source,
      correlationId,
      msg,
      ...baseMeta,
      ...extra,
    });
  }

  // Readable dev format
  const tag = `[${source}]`;
  const metaStr =
    extra && Object.keys(extra).length > 0 ? " " + JSON.stringify(extra) : "";
  return `${tag} ${msg}${metaStr}`;
}

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

function makeLogger(
  source: string,
  correlationId: string,
  baseMeta: LogMeta,
): Logger {
  const emit = (level: LogLevel, msg: string, extra?: LogMeta) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

    const line = formatLog(level, source, correlationId, msg, baseMeta, extra);

    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
  };

  return {
    debug: (msg, meta?) => emit("debug", msg, meta),
    info: (msg, meta?) => emit("info", msg, meta),
    warn: (msg, meta?) => emit("warn", msg, meta),
    error: (msg, meta?) => emit("error", msg, meta),
    child: (extra) =>
      makeLogger(source, correlationId, { ...baseMeta, ...extra }),
    get correlationId() {
      return correlationId;
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new structured logger.
 *
 * @param source - Component name (e.g. "echotik-cron", "cron/sync-db")
 * @param correlationId - Optional; auto-generated UUID if omitted
 */
export function createLogger(source: string, correlationId?: string): Logger {
  return makeLogger(source, correlationId ?? randomUUID(), {});
}
