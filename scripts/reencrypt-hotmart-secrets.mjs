/**
 * Re-encrypts Hotmart secrets in the DB using the current SETTINGS_ENCRYPTION_KEY.
 * Run after setting/rotating encryption keys, or when decryption errors occur.
 *
 * Usage: node scripts/reencrypt-hotmart-secrets.mjs
 */
import { createHash, createCipheriv, randomBytes } from "crypto";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env manually
const envLine = readFileSync(resolve(root, ".env"), "utf8");
const env = {};
for (const line of envLine.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"#\n]*)"?\s*(?:#.*)?$/);
  if (m) env[m[1]] = m[2].trim();
}
Object.assign(process.env, env);

const require = createRequire(import.meta.url);
const { Client } = require("pg");

// ---------------------------------------------------------------------------
// Crypto helpers (mirrors lib/crypto.ts)
// ---------------------------------------------------------------------------
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const raw =
    process.env.SETTINGS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error("No encryption key available");
  return createHash("sha256").update(raw).digest();
}

function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

// ---------------------------------------------------------------------------
// Known plaintext values (from .env commented block / source of truth)
// ---------------------------------------------------------------------------
const SECRETS = [
  {
    key: "hotmart.client_id",
    plain: "26d9519a-b5b6-49bf-b257-1a8994c43658",
    secret: false,
  },
  {
    key: "hotmart.client_secret",
    plain: "93b8e559-6e9d-449b-97af-5ed3a49c3e09",
    secret: true,
  },
  {
    key: "hotmart.basic_token",
    plain:
      "MjZkOTUxOWEtYjViNi00OWJmLWIyNTctMWE4OTk0YzQzNjU4OjkzYjhlNTU5LTZlOWQtNDQ5Yi05N2FmLTVlZDNhNDljM2UwOQ==",
    secret: true,
  },
  {
    key: "hotmart.webhook_secret",
    plain: "POIvKwDKdcj9vz6bLggzjhoRT8LpnY5103386d-e55e-40d1-ac5a-99785836fdd7",
    secret: true,
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const db = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!db) throw new Error("DATABASE_URL not configured");

const c = new Client({ connectionString: db });
await c.connect();

for (const { key, plain, secret } of SECRETS) {
  const value = secret ? encrypt(plain) : plain;
  await c.query(
    `INSERT INTO "Setting" (key, value, "updatedAt")
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
    [key, value],
  );
  console.log(`✓ ${key}`);
}

await c.end();
console.log("Done — all Hotmart secrets re-encrypted and saved.");
