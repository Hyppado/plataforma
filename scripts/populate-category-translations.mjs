/**
 * scripts/populate-category-translations.mjs
 *
 * Standalone script — populates EchotikCategory.namePt via OpenAI directly.
 * Runs against production and preview DBs without needing the app settings system.
 *
 * Usage:
 *   node scripts/populate-category-translations.mjs
 */

import pg from "pg";
import { createHash } from "crypto";

const { Client } = pg;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY env var is required");

const PROD_DB_URL = process.env.PROD_DATABASE_URL;
const PREVIEW_DB_URL = process.env.PREVIEW_DATABASE_URL;

const DATABASES = [
  ...(PROD_DB_URL ? [{ label: "production", url: PROD_DB_URL }] : []),
  ...(PREVIEW_DB_URL ? [{ label: "preview", url: PREVIEW_DB_URL }] : []),
];

if (DATABASES.length === 0) {
  throw new Error("Set PROD_DATABASE_URL and/or PREVIEW_DATABASE_URL env vars");
}

const BATCH_SIZE = 50;
const OPENAI_API = "https://api.openai.com/v1/chat/completions";

async function translateBatch(names) {
  const prompt =
    `Translate the following English TikTok Shop product category names to Brazilian Portuguese (pt-BR).\n` +
    `Return ONLY a JSON object where the keys are the original English names and the values are the Portuguese translations.\n` +
    `Do not add explanations. Keep translations concise and natural for an e-commerce context.\n\n` +
    `Names:\n${names.map((n) => `- ${n}`).join("\n")}`;

  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional e-commerce translator. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

async function processDatabase({ label, url }) {
  console.log(`\n=== ${label.toUpperCase()} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Ensure the column exists (idempotent)
    await client.query(
      `ALTER TABLE "EchotikCategory" ADD COLUMN IF NOT EXISTS "namePt" TEXT`,
    );
    console.log('Column "namePt" ensured.');
    // Mark the Prisma migration as applied so `migrate deploy` doesn't re-run it
    const migrationName = "20260418120000_add_category_name_pt";
    const migrationSql = `-- AddColumn: namePt (nullable) to EchotikCategory\nALTER TABLE "EchotikCategory" ADD COLUMN "namePt" TEXT;\n`;
    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       SELECT gen_random_uuid(), $1::text, now(), $2::text, NULL, NULL, now(), 1
       WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $2::text)`,
      [checksum, migrationName],
    );
    console.log("Migration record ensured in _prisma_migrations.");
    const { rows } = await client.query(
      `SELECT "externalId", "name" FROM "EchotikCategory" WHERE "namePt" IS NULL ORDER BY "level" ASC`,
    );

    if (rows.length === 0) {
      console.log("All categories already translated — nothing to do.");
      return;
    }

    console.log(`Found ${rows.length} untranslated categories.`);
    let total = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const names = batch.map((r) => r.name);

      console.log(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} names)...`,
      );

      try {
        const translations = await translateBatch(names);

        for (const row of batch) {
          const namePt = translations[row.name];
          if (!namePt) continue;
          await client.query(
            `UPDATE "EchotikCategory" SET "namePt" = $1 WHERE "externalId" = $2`,
            [namePt, row.externalId],
          );
          total++;
        }
      } catch (err) {
        console.error(`  Batch failed: ${err.message}`);
      }
    }

    console.log(`Done — ${total} rows updated.`);
  } finally {
    await client.end();
  }
}

for (const db of DATABASES) {
  await processDatabase(db);
}

console.log("\nAll done.");
