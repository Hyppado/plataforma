/**
 * Isolated test of Echotik endpoints:
 * 1. /realtime/video/captions — subtitle/text extraction
 * 2. /realtime/video/download-url — video download URLs
 *
 * Run: node scripts/test-echotik-endpoints.mjs
 */

import { readFileSync } from "fs";

// Load .env manually
const envContent = readFileSync(new URL("../.env", import.meta.url), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const username = process.env.ECHOTIK_USERNAME;
const password = process.env.ECHOTIK_PASSWORD;
const auth =
  "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

// Use the video ID from Echotik docs, or pass one as argument
const videoId = process.argv[2] || "7563511121240395022";

console.log(`Testing with video_id: ${videoId}\n`);

// ---------------------------------------------------------------------------
// Test 1: Captions endpoint
// ---------------------------------------------------------------------------
async function testCaptions() {
  console.log("=== TEST 1: /realtime/video/captions ===");
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://open.echotik.live/api/v3/realtime/video/captions?video_id=${videoId}`,
      {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const elapsed = Date.now() - t0;
    const body = await res.json();

    console.log("HTTP Status:", res.status);
    console.log("Time:", elapsed, "ms");
    console.log("API Code:", body.code, "| Msg:", body.msg);

    if (body.data && Array.isArray(body.data)) {
      console.log("Captions count:", body.data.length);
      body.data.forEach((c, i) => {
        const dataLen = c.data ? c.data.length : 0;
        console.log(`  [${i}] lang=${c.lang}, data_length=${dataLen}`);
        if (c.data) {
          console.log("  preview:", c.data.substring(0, 200));
        }
      });
    } else {
      console.log(
        "Data:",
        JSON.stringify(body.data || body).substring(0, 400),
      );
    }
    return { elapsed, success: body.code === 0, hasData: !!body.data?.length };
  } catch (e) {
    const elapsed = Date.now() - t0;
    console.log("ERROR:", e.message);
    return { elapsed, success: false, hasData: false };
  }
}

// ---------------------------------------------------------------------------
// Test 2: Download URL endpoint
// ---------------------------------------------------------------------------
async function testDownloadUrl() {
  console.log("\n=== TEST 2: /realtime/video/download-url ===");
  const tiktokUrl = `https://www.tiktok.com/@user/video/${videoId}`;
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://open.echotik.live/api/v3/realtime/video/download-url?url=${encodeURIComponent(tiktokUrl)}`,
      {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const elapsed = Date.now() - t0;
    const body = await res.json();

    console.log("HTTP Status:", res.status);
    console.log("Time:", elapsed, "ms");
    console.log("API Code:", body.code, "| Message:", body.message);

    if (body.data) {
      console.log("Has play_url:", !!body.data.play_url);
      console.log("Has download_url:", !!body.data.download_url);
      console.log(
        "Has no_watermark_download_url:",
        !!body.data.no_watermark_download_url,
      );
      console.log("video_id:", body.data.video_id);

      if (body.data.no_watermark_download_url) {
        console.log(
          "no_watermark prefix:",
          body.data.no_watermark_download_url.substring(0, 100),
        );
      }
    } else {
      console.log("Data:", JSON.stringify(body).substring(0, 400));
    }
    return {
      elapsed,
      success: body.code === 0,
      hasDownloadUrl: !!body.data?.no_watermark_download_url,
    };
  } catch (e) {
    const elapsed = Date.now() - t0;
    console.log("ERROR:", e.message);
    return { elapsed, success: false, hasDownloadUrl: false };
  }
}

// ---------------------------------------------------------------------------
// Test 3: Actually download the video and measure size/time
// ---------------------------------------------------------------------------
async function testVideoDownload(downloadUrl) {
  if (!downloadUrl) {
    console.log("\n=== TEST 3: Video download — SKIPPED (no URL) ===");
    return null;
  }
  console.log("\n=== TEST 3: Download video file ===");
  const t0 = Date.now();
  try {
    const res = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    const elapsed = Date.now() - t0;
    const buffer = await res.arrayBuffer();
    const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);

    console.log("HTTP Status:", res.status);
    console.log("Time:", elapsed, "ms");
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Size:", sizeMB, "MB", `(${buffer.byteLength} bytes)`);
    return { elapsed, sizeBytes: buffer.byteLength, sizeMB };
  } catch (e) {
    const elapsed = Date.now() - t0;
    console.log("ERROR:", e.message);
    return { elapsed, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------
(async () => {
  const r1 = await testCaptions();
  const r2 = await testDownloadUrl();

  // If we got a download URL, actually download the video to measure
  let downloadUrl = null;
  if (r2.success) {
    // Re-fetch to get the actual URL (we didn't store it above)
    const tiktokUrl = `https://www.tiktok.com/@user/video/${videoId}`;
    const res = await fetch(
      `https://open.echotik.live/api/v3/realtime/video/download-url?url=${encodeURIComponent(tiktokUrl)}`,
      { headers: { Authorization: auth } },
    );
    const body = await res.json();
    downloadUrl = body.data?.no_watermark_download_url || body.data?.play_url;
  }
  const r3 = await testVideoDownload(downloadUrl);

  console.log("\n========== SUMMARY ==========");
  console.log("Captions:     ", r1.elapsed, "ms | success:", r1.success, "| has data:", r1.hasData);
  console.log("Download URL: ", r2.elapsed, "ms | success:", r2.success, "| has URL:", r2.hasDownloadUrl);
  if (r3) {
    console.log(
      "Video DL:     ",
      r3.elapsed,
      "ms |",
      r3.sizeMB || "N/A",
      "MB",
    );
  }
  console.log(
    "\nTotal pipeline (download-url + video DL):",
    r2.elapsed + (r3?.elapsed || 0),
    "ms",
  );
  console.log(
    "Caption-only approach:",
    r1.elapsed,
    "ms (instant text, no Whisper needed)",
  );
})();
