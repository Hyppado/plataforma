import pg from "pg";
import { createHash } from "crypto";
const { Client } = pg;

const DBS = [
  {
    label: "production",
    url: "postgresql://neondb_owner:npg_6kUMvEIq5fRs@ep-nameless-paper-anvlh1rs.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require",
  },
];

const migrationName = "20260418140000_add_first_crawl_dt_to_product_detail";
const migrationSql =
  `ALTER TABLE "EchotikProductDetail" ADD COLUMN "firstCrawlDt" INTEGER;\n` +
  `CREATE INDEX "EchotikProductDetail_firstCrawlDt_idx" ON "EchotikProductDetail"("firstCrawlDt");\n`;
const checksum = createHash("sha256").update(migrationSql).digest("hex");

for (const db of DBS) {
  const client = new Client({ connectionString: db.url });
  await client.connect();
  console.log(`\n=== ${db.label.toUpperCase()} ===`);

  // Apply column + index idempotently
  await client.query(
    `ALTER TABLE "EchotikProductDetail" ADD COLUMN IF NOT EXISTS "firstCrawlDt" INTEGER`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS "EchotikProductDetail_firstCrawlDt_idx" ON "EchotikProductDetail"("firstCrawlDt")`,
  );
  console.log("  Column + index ensured.");

  // Register migration
  await client.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     SELECT gen_random_uuid(), $1::text, now(), $2::text, NULL, NULL, now(), 1
     WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $2::text)`,
    [checksum, migrationName],
  );
  console.log("  Migration record ensured.");
  await client.end();
}

console.log("\nDone.");
