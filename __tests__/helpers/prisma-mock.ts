/**
 * Prisma mock singleton for tests.
 *
 * Usage:
 *   import { prismaMock } from "@tests/helpers/prisma-mock";
 *
 * All Prisma models are auto-mocked with vi.fn().
 * Access nested properties like: prismaMock.user.findUnique.mockResolvedValue(...)
 */
import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Deep-mocked PrismaClient type.
 * Every model delegate method becomes a Vitest Mock so that
 * .mockResolvedValue(), .mock.calls, etc. are recognised by TS.
 */
type MockDelegate<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn> & T[K]
    : T[K];
};

type MockPrismaClient = {
  [K in keyof PrismaClient]: PrismaClient[K] extends object
    ? MockDelegate<PrismaClient[K]>
    : PrismaClient[K];
};

// Creates a deeply nested mock proxy that returns vi.fn() for any property access
function createPrismaMock(): PrismaClient {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop === "$transaction") {
        if (!target[prop]) {
          target[prop] = vi.fn().mockImplementation(async (arg: unknown) => {
            if (typeof arg === "function") {
              return arg(createPrismaMock());
            }
            // Array of promises
            if (Array.isArray(arg)) {
              return Promise.all(arg);
            }
            return arg;
          });
        }
        return target[prop];
      }

      if (prop === "$connect" || prop === "$disconnect") {
        if (!target[prop]) {
          target[prop] = vi.fn().mockResolvedValue(undefined);
        }
        return target[prop];
      }

      // For model properties (user, plan, etc.), return a proxy with mock methods
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, unknown>, {
          get(modelTarget, methodName: string) {
            if (!modelTarget[methodName]) {
              modelTarget[methodName] = vi.fn().mockResolvedValue(null);
            }
            return modelTarget[methodName];
          },
        });
      }
      return target[prop];
    },
  };

  return new Proxy(
    {} as Record<string, unknown>,
    handler,
  ) as unknown as PrismaClient;
}

export const prismaMock = createPrismaMock() as unknown as MockPrismaClient;

// Auto-mock the prisma singleton module
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

// Also mock the direct import path used by some files
vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));
