# Technology Stack

> **Last updated**: 2026-08-06 (refresh — no dependency changes; adds the Shopee Affiliate API integration)

## Programming Languages
- **TypeScript** — 5.3.x — All application code (frontend, backend, tests)
- **JavaScript** — (via .mjs scripts) — Admin/diagnostic one-off scripts in `scripts/`

## Frameworks
- **Next.js** — 14.2.35 — App Router; full-stack React framework (SSR + serverless API routes)
- **React** — 18.2 — UI component library
- **NextAuth.js** — 4.24.13 — Authentication (credentials provider, JWT sessions)

## UI / Styling
- **Material UI (MUI)** — 5.15.x — Component library (buttons, modals, tables, tabs, etc.)
- **Emotion** — 11.11.x — CSS-in-JS, required by MUI
- **globals.css** — Global CSS for base styles

## ORM / Database
- **Prisma** — 5.22.0 — ORM for PostgreSQL. Schema at `prisma/schema.prisma`
- **PostgreSQL** — via Neon (managed serverless Postgres)
  - Pooled connection: `DATABASE_URL` (PgBouncer)
  - Direct connection: `DATABASE_URL_UNPOOLED` (for migrations)

## AI / ML
- **Google GenAI** (`@google/genai`) — 2.1.0 — Gemini models for Influencer IA and Avatar Video concept/prompt generation
- **OpenAI** (via REST API — no SDK dependency) — Whisper for audio transcription; GPT for video insights; `gpt-4o-mini` (temperature 0.1, 30s timeout) for Shopee product-name extraction

## External Data & Monetization APIs
- **EchoTik API** (REST, HTTP Basic) — TikTok Shop trending data; also `/api/v3/realtime/hashtag/video/list`, video captions, and video download URLs consumed by the Shopee achadinhos pipeline
- **Shopee Affiliate Open API** (GraphQL) — `https://open-api.affiliate.shopee.com.br/graphql`
  - Operations used: `productOfferV2` (keyword search, `sortType`, limit) and `generateShortLink` (with sub-IDs)
  - Auth: SHA-256 of `appId + timestamp + payload + appSecret`, sent as `Authorization: SHA256 Credential=…, Timestamp=…, Signature=…`
  - No client library — implemented with `fetch` + `node:crypto` in `lib/shopee/shopee-api-client.ts` (15s timeout)
  - Credentials read from the encrypted `Setting` table, falling back to `SHOPEE_AFFILIATE_APP_ID` / `SHOPEE_AFFILIATE_API_SECRET` env vars
- **Hotmart API** (REST, OAuth2 client credentials + HMAC webhooks) — subscription billing

## Storage
- **Vercel Blob** — 2.3.3 — Object storage for images (creator avatars, product covers, user uploads)

## Data Fetching (Client)
- **SWR** — 2.4.1 — React hooks for client-side data fetching with stale-while-revalidate

## Email
- **Resend** — 6.10.0 — Transactional email API

## Image Processing
- **Sharp** — 0.34.5 — Server-side image resizing and format conversion

## Security
- **bcryptjs** — 3.0.3 — Password hashing
- Custom nonce-based CSP via Next.js middleware (allow-list extended for Shopee CDN hosts)
- HMAC verification for Hotmart webhooks (via Node.js `crypto`)
- SHA-256 request signing for the Shopee Affiliate API (via Node.js `crypto`)
- `timingSafeEqual` comparison of `CRON_SECRET` on every cron route
- AES-256-GCM encryption for stored secrets (`lib/crypto.ts`) — now also covers the Shopee App ID and API Secret

## Build Tools
- **npm** — Package manager
- **tsx** — 4.7.0 — TypeScript execution for scripts and seeds
- **vite-tsconfig-paths** — 6.1.1 — TypeScript path aliases in tests

## Testing Tools
- **Vitest** — 4.1.0 — Unit and component test runner (two configs: node + jsdom)
- **@testing-library/react** — 14.3.1 — Component testing utilities
- **@testing-library/user-event** — 14.6.1 — User interaction simulation
- **@vitest/coverage-v8** — 4.1.0 — Code coverage
- **Playwright** — 1.58.2 — E2E smoke tests
- **jsdom** — 28.1.0 — DOM simulation for component tests

## Infrastructure
- **Vercel** — Hosting platform (serverless functions, cron, blob, CDN)
- **Neon** — Serverless PostgreSQL provider
- **GitHub Actions** — CI/CD pipeline

## Dev Environment
- **Node.js** — >=20.0.0 (required)
