/**
 * Tests: lib/logger.ts — Structured logger with correlation IDs
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to dynamically import to control env vars
let createLogger: typeof import("@/lib/logger").createLogger;

describe("createLogger()", () => {
  const origEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    process.env.LOG_FORMAT = "text"; // force readable format
    delete process.env.LOG_LEVEL;
    const mod = await import("@/lib/logger");
    createLogger = mod.createLogger;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it("creates a logger with auto-generated correlationId", () => {
    const log = createLogger("test-source");
    expect(log.correlationId).toBeDefined();
    expect(log.correlationId.length).toBeGreaterThan(8);
  });

  it("uses provided correlationId", () => {
    const log = createLogger("test-source", "my-custom-id");
    expect(log.correlationId).toBe("my-custom-id");
  });

  it("logs info with source tag", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test-source");

    log.info("Hello world");

    expect(spy).toHaveBeenCalledTimes(1);
    const msg = spy.mock.calls[0][0];
    expect(msg).toContain("[test-source]");
    expect(msg).toContain("Hello world");
  });

  it("logs warn via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("test");

    log.warn("Warning msg");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("logs error via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test");

    log.error("Error msg");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("includes extra metadata in output", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");

    log.info("With meta", { region: "BR", count: 42 });

    const msg = spy.mock.calls[0][0];
    expect(msg).toContain("region");
    expect(msg).toContain("BR");
  });

  it("child logger inherits correlationId", () => {
    const parent = createLogger("parent", "corr-123");
    const child = parent.child({ runId: "abc" });

    expect(child.correlationId).toBe("corr-123");
  });

  it("child logger logs with inherited context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const parent = createLogger("parent");
    const child = parent.child({ runId: "abc" });

    child.info("From child", { extra: true });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("createLogger() — JSON mode", () => {
  const origEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    process.env.LOG_FORMAT = "json";
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it("outputs valid JSON when LOG_FORMAT=json", async () => {
    const { createLogger: create } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = create("json-test", "id-1");

    log.info("JSON msg", { key: "val" });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.ts).toBeDefined();
    expect(parsed.level).toBe("info");
    expect(parsed.source).toBe("json-test");
    expect(parsed.correlationId).toBe("id-1");
    expect(parsed.msg).toBe("JSON msg");
    expect(parsed.key).toBe("val");
  });
});
