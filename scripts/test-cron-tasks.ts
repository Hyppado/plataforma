/**
 * scripts/test-cron-tasks.ts
 *
 * Runs the echotik cron post-ingestion tasks in isolation locally:
 *   - details        → enrich product details missing from DB (batch: 2)
 *   - upload-images  → upload product covers + creator avatars to Vercel Blob (batch: 3 each)
 *   - cache-download-urls → pre-cache video download URLs (batch: 3)
 *
 * Uses the real lib code — same paths as production.
 * Mild batch sizes to avoid hammering APIs.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.json scripts/test-cron-tasks.ts [task]
 *
 * Where [task] is one of: details | upload-images | cache-download-urls | all (default)
 */

// Load .env manually (same pattern as other scripts in this folder)
import { readFileSync } from "fs";
import { resolve } from "path";
const envPath = resolve(new URL(".", import.meta.url).pathname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (match)
    process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1");
}

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncVideoProductDetails } from "@/lib/echotik/cron/syncVideos";
import { syncRanklistProductDetails } from "@/lib/echotik/cron/syncProducts";
import { uploadEchotikImageToBlob } from "@/lib/storage/blob";
import { echotikRequest } from "@/lib/echotik/client";

// ---------------------------------------------------------------------------
// Mild batch sizes — smaller than production defaults
// ---------------------------------------------------------------------------
const MILD_BATCH = 3;

const log = createLogger("test-cron");
const task = process.argv[2] ?? "all";

// ---------------------------------------------------------------------------
// Task: details (product enrichment)
// Calls the real sync functions but short-circuits via DB—if no missing
// products, it returns 0 quickly without API calls.
// ---------------------------------------------------------------------------
async function testDetails() {
  console.log("\n─── TASK: details ───────────────────────────────────────");

  // Show how many products need enrichment before running
  const missingCount = await prisma.echotikProductDetail.count({
    where: { coverUrl: null },
  });
  const videoProductsNeeded = await (async () => {
    // Count videos from last 24h that have product IDs in extra
    const recent = await prisma.echotikVideoTrendDaily.count({
      where: { syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return recent;
  })();

  console.log(`Videos from last 24h:    ${videoProductsNeeded}`);
  console.log(`Products missing detail: ${missingCount}`);

  console.log(
    "\nRunning syncVideoProductDetails (real, mild = stops at first 2 fetches)...",
  );
  const videoEnriched = await syncVideoProductDetails(log);
  console.log(`→ syncVideoProductDetails enriched: ${videoEnriched}`);

  console.log("\nRunning syncRanklistProductDetails...");
  const ranklistEnriched = await syncRanklistProductDetails(log);
  console.log(`→ syncRanklistProductDetails enriched: ${ranklistEnriched}`);

  console.log(
    `\n✓ details total enriched: ${videoEnriched + ranklistEnriched}`,
  );
}

// ---------------------------------------------------------------------------
// Task: upload-images (product covers + creator avatars)
// Runs the real queries but caps at MILD_BATCH via direct DB query,
// then calls the real uploadEchotikImageToBlob.
// ---------------------------------------------------------------------------
async function testUploadImages() {
  console.log("\n─── TASK: upload-images ─────────────────────────────────");

  // --- Products ---
  const products = await prisma.echotikProductDetail.findMany({
    where: { coverUrl: { not: null }, blobUrl: null },
    select: { id: true, productExternalId: true, coverUrl: true },
    take: MILD_BATCH,
    orderBy: { fetchedAt: "desc" },
  });
  console.log(
    `Products needing cover upload (showing up to ${MILD_BATCH}): ${products.length}`,
  );

  let productUploaded = 0;
  for (const p of products) {
    const blobPath = `products/${p.productExternalId}.jpg`;
    console.log(`  Uploading product ${p.productExternalId} → ${blobPath}`);
    const blobUrl = await uploadEchotikImageToBlob(p.coverUrl!, blobPath);
    if (blobUrl) {
      await prisma.echotikProductDetail.update({
        where: { id: p.id },
        data: { blobUrl },
      });
      console.log(`  ✓ blobUrl: ${blobUrl}`);
      productUploaded++;
    } else {
      console.log(`  ✗ Upload failed for product ${p.productExternalId}`);
    }
  }

  // --- Creators ---
  const creators = await prisma.echotikCreatorTrendDaily.findMany({
    where: { avatar: { not: null }, avatarBlobUrl: null },
    select: { id: true, userExternalId: true, avatar: true },
    distinct: ["userExternalId"],
    take: MILD_BATCH,
    orderBy: { date: "desc" },
  });
  console.log(
    `\nCreators needing avatar upload (showing up to ${MILD_BATCH}): ${creators.length}`,
  );

  let creatorUploaded = 0;
  for (const c of creators) {
    const blobPath = `creators/${c.userExternalId}.jpg`;
    console.log(`  Uploading creator ${c.userExternalId} → ${blobPath}`);
    const blobUrl = await uploadEchotikImageToBlob(c.avatar!, blobPath);
    if (blobUrl) {
      await prisma.echotikCreatorTrendDaily.updateMany({
        where: { userExternalId: c.userExternalId, avatar: c.avatar },
        data: { avatarBlobUrl: blobUrl },
      });
      console.log(`  ✓ blobUrl: ${blobUrl}`);
      creatorUploaded++;
    } else {
      console.log(`  ✗ Upload failed for creator ${c.userExternalId}`);
    }
  }

  console.log(
    `\n✓ upload-images: ${productUploaded} products + ${creatorUploaded} creators`,
  );
}

// ---------------------------------------------------------------------------
// Task: cache-download-urls
// Fetches Echotik download URLs for the first MILD_BATCH videos that need them.
// ---------------------------------------------------------------------------
async function testCacheDownloadUrls() {
  console.log("\n─── TASK: cache-download-urls ───────────────────────────");

  const staleThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const videos = await prisma.echotikVideoTrendDaily.findMany({
    where: {
      OR: [
        { downloadUrl: null },
        { downloadUrlFetchedAt: { lt: staleThreshold } },
      ],
    },
    select: { videoExternalId: true },
    distinct: ["videoExternalId"],
    take: MILD_BATCH,
    orderBy: { date: "desc" },
  });

  console.log(
    `Videos needing download URL (showing up to ${MILD_BATCH}): ${videos.length}`,
  );

  let cached = 0;
  for (const v of videos) {
    const tiktokUrl = `https://www.tiktok.com/@user/video/${v.videoExternalId}`;
    console.log(`  Fetching URL for video ${v.videoExternalId}...`);
    try {
      const resp = await echotikRequest<{
        code: number;
        data?: {
          no_watermark_download_url?: string;
          download_url?: string;
          play_url?: string;
        };
      }>("/api/v3/realtime/video/download-url", {
        params: { url: tiktokUrl },
        timeout: 20_000,
      });

      if (resp.code !== 0 || !resp.data) {
        console.log(`  ✗ No URL (code=${resp.code})`);
        continue;
      }
      const url =
        resp.data.no_watermark_download_url ??
        resp.data.download_url ??
        resp.data.play_url;

      if (!url) {
        console.log(`  ✗ Empty URL in response`);
        continue;
      }

      await prisma.echotikVideoTrendDaily.updateMany({
        where: { videoExternalId: v.videoExternalId },
        data: { downloadUrl: url, downloadUrlFetchedAt: new Date() },
      });
      console.log(`  ✓ Cached: ${url.slice(0, 60)}...`);
      cached++;
    } catch (err) {
      console.log(
        `  ✗ Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`\n✓ cache-download-urls: ${cached}/${videos.length} cached`);
}

// ---------------------------------------------------------------------------
// DB context overview
// ---------------------------------------------------------------------------
async function printDbContext() {
  const [
    videoCount,
    productCount,
    creatorCount,
    productDetailCount,
    ingestionCount,
  ] = await Promise.all([
    prisma.echotikVideoTrendDaily.count(),
    prisma.echotikProductTrendDaily.count(),
    prisma.echotikCreatorTrendDaily.count(),
    prisma.echotikProductDetail.count(),
    prisma.ingestionRun.count(),
  ]);

  const pendingProductImages = await prisma.echotikProductDetail.count({
    where: { coverUrl: { not: null }, blobUrl: null },
  });
  const pendingCreatorAvatars = await prisma.echotikCreatorTrendDaily.count({
    where: { avatar: { not: null }, avatarBlobUrl: null },
  });
  const pendingDownloadUrls = await prisma.echotikVideoTrendDaily.count({
    where: { downloadUrl: null },
    // count distinct videos
  });

  console.log("\n═══ DB Context ════════════════════════════════════════");
  console.log(`  EchotikVideoTrendDaily:   ${videoCount} rows`);
  console.log(`  EchotikProductTrendDaily: ${productCount} rows`);
  console.log(`  EchotikCreatorTrendDaily: ${creatorCount} rows`);
  console.log(`  EchotikProductDetail:     ${productDetailCount} rows`);
  console.log(`  IngestionRun records:     ${ingestionCount}`);
  console.log(`  --- Pending work ---`);
  console.log(`  Product images without blobUrl:  ${pendingProductImages}`);
  console.log(`  Creator avatars without blobUrl: ${pendingCreatorAvatars}`);
  console.log(`  Videos without downloadUrl:      ${pendingDownloadUrls}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\ntest-cron-tasks — task="${task}", mild batch=${MILD_BATCH}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL?.slice(0, 50)}...`);

  await printDbContext();

  try {
    if (task === "details" || task === "all") await testDetails();
    if (task === "upload-images" || task === "all") await testUploadImages();
    if (task === "cache-download-urls" || task === "all")
      await testCacheDownloadUrls();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
