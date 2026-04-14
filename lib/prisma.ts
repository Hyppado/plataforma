import { PrismaClient } from "@prisma/client";

declare global {
  // Guardamos o cliente em global para evitar múltiplas instâncias em hot-reload (dev)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export default prisma;
