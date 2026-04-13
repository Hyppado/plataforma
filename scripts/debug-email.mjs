/**
 * Debug script: check user data + test email sending
 *
 * Usage: node scripts/debug-email.mjs
 *
 * This script:
 * 1. Looks up canalevenogueira@gmail.com in the database
 * 2. Lists recent users if not found
 * 3. Checks Resend API key configuration
 * 4. Attempts to send a test email directly via Resend
 */

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();

const TARGET_EMAIL = "canalevenogueira@gmail.com";

async function main() {
  console.log("=== 1. Looking up user in database ===\n");

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: "canalevenogueira", mode: "insensitive" } },
        { email: { contains: "canal.eve", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: true,
      passwordHash: true,
      setupToken: true,
      setupTokenExpiresAt: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  if (user) {
    console.log("Found user:");
    console.log({
      ...user,
      passwordHash: user.passwordHash ? "[SET]" : "[NULL]",
      setupToken: user.setupToken ? "[SET]" : "[NULL]",
    });
  } else {
    console.log(`User with email containing 'canalevenogueira' NOT FOUND.`);
    console.log("\nRecent users:");
    const recent = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        passwordHash: true,
        setupToken: true,
      },
    });
    for (const u of recent) {
      console.log(
        `  ${u.email} | status=${u.status} | pwd=${u.passwordHash ? "yes" : "no"} | token=${u.setupToken ? "yes" : "no"} | ${u.createdAt.toISOString()}`,
      );
    }
  }

  // Check webhook events for this email
  console.log("\n=== 2. Checking Hotmart webhook events ===\n");

  const events = await prisma.hotmartWebhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 10,
    select: {
      id: true,
      eventType: true,
      processingStatus: true,
      idempotencyKey: true,
      buyerEmail: true,
      subscriberEmail: true,
      receivedAt: true,
    },
  });

  if (events.length) {
    console.log(`Found ${events.length} recent webhook events:`);
    for (const e of events) {
      console.log(
        `  ${e.eventType} | ${e.processingStatus} | ${e.receivedAt.toISOString()} | buyer=${e.buyerEmail} | subscriber=${e.subscriberEmail}`,
      );
    }
  } else {
    console.log("No webhook events found at all.");
  }

  // Check ExternalAccountLink
  console.log("\n=== 3. Checking ExternalAccountLink ===\n");

  const links = await prisma.externalAccountLink.findMany({
    where: {
      externalEmail: { contains: "canalevenogueira", mode: "insensitive" },
    },
    select: {
      id: true,
      provider: true,
      externalEmail: true,
      externalCustomerId: true,
      userId: true,
      createdAt: true,
    },
  });

  if (links.length) {
    console.log(`Found ${links.length} external links:`);
    for (const l of links) {
      console.log(`  ${l.provider} | ${l.externalEmail} | userId=${l.userId}`);
    }
  } else {
    console.log("No external account links found.");
  }

  // Check RESEND_API_KEY
  console.log("\n=== 4. Checking Resend configuration ===\n");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "❌ RESEND_API_KEY is NOT set in environment. Emails will NOT be sent.",
    );
    console.log(
      "   Found in .env: xxd=... — this should be RESEND_API_KEY=...",
    );

    // Try with the xxd value directly
    const xxdKey = process.env.xxd;
    if (xxdKey) {
      console.log(
        `\n   Found 'xxd' env var with value starting with: ${xxdKey.substring(0, 10)}...`,
      );
      console.log("   Attempting to send test email using this key...\n");
      await sendTestEmail(xxdKey);
    }
  } else {
    console.log(
      `✅ RESEND_API_KEY is set (starts with: ${apiKey.substring(0, 10)}...)`,
    );
    await sendTestEmail(apiKey);
  }

  await prisma.$disconnect();
}

async function sendTestEmail(apiKey) {
  console.log("=== 5. Sending test email ===\n");

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: "Hyppado <suporte@hyppado.com>",
      to: TARGET_EMAIL,
      subject: "[TEST] Teste de entrega - Hyppado",
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #12141c; color: #fff; border-radius: 8px;">
          <h2 style="color: #2DD4FF;">Teste de email - Hyppado</h2>
          <p>Este é um email de teste para verificar a entrega via Resend.</p>
          <p>Horário: ${new Date().toISOString()}</p>
          <p style="color: rgba(255,255,255,0.5); font-size: 12px;">Se você recebeu este email, a integração Resend está funcionando.</p>
        </div>
      `,
      text: `Teste de email - Hyppado\n\nEste é um email de teste.\nHorário: ${new Date().toISOString()}`,
      replyTo: "suportehyppado@gmail.com",
    });

    if (result.error) {
      console.log("❌ Resend API error:", result.error);
    } else {
      console.log("✅ Email sent successfully!");
      console.log("   Message ID:", result.data?.id);
    }
  } catch (err) {
    console.log("❌ Exception sending email:", err.message);
  }
}

main().catch(console.error);
