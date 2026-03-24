/**
 * Cria ou atualiza um usuário ADMIN com a senha fornecida.
 * Uso: npx tsx prisma/create-admin.ts <email> <senha>
 *
 * Exemplo:
 *   npx tsx prisma/create-admin.ts admin@hyppado.com MinhaS3nha!
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error("Uso: npx tsx prisma/create-admin.ts <email> <senha>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    create: {
      email: email.toLowerCase().trim(),
      name: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
  });

  console.log(
    `✅ Usuário ADMIN criado/atualizado: ${user.email} (id: ${user.id})`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
