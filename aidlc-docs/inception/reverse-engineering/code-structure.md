# Code Structure

> **Last updated**: 2026-08-06 (refresh — adds `lib/shopee/`, Shopee pages/components; corrects the Prisma model count)

## Build System
- **Type**: npm
- **Configuration**: `package.json`, `tsconfig.json`, `next.config.js`, `vercel.json`
- **Key scripts**:
  - `npm run dev` — local development server
  - `npm run build` — production build
  - `npm run test` — Vitest unit tests (node env)
  - `npm run test:components` — Vitest component tests (jsdom env)
  - `npm run test:all` — unit + component tests
  - `npm run test:e2e` — Playwright E2E smoke tests
  - `npm run db:migrate` — Prisma dev migration
  - `npm run db:deploy` — Prisma deploy migration
  - `npm run seed` — seed default data
- **Vercel build command**: `npx prisma migrate deploy && npx prisma generate && next build` — migrations are applied automatically at build time (changed in `c097772`)

## Folder Structure

```
hyppado/
+-- app/                        Next.js App Router root
|   +-- api/                    API Routes (93 route.ts handlers)
|   |   +-- admin/              Admin-only API endpoints
|   |   |   +-- settings/shopee/  Shopee Affiliate credentials + tuning  (NEW)
|   |   +-- auth/               NextAuth + password setup/reset
|   |   +-- avatar-video/       Avatar profile listing
|   |   +-- cron/               Scheduled background jobs
|   |   |   +-- shopee/         Shopee ranking + achadinhos cron        (NEW)
|   |   +-- echotik/            Trending data endpoints (videos, categories)
|   |   +-- exchange-rate/      USD/BRL rate endpoint
|   |   +-- influencer-ia/      Influencer IA wizard endpoints
|   |   +-- insights/           AI insight endpoints
|   |   +-- me/                 User profile endpoints
|   |   +-- plans/              Plan listing
|   |   +-- privacidade/        Privacy policy content
|   |   +-- prompt-library/     Prompt library listing
|   |   +-- proxy/              Image proxy (CORS bypass for TikTok CDN)
|   |   +-- public/             Unauthenticated endpoints
|   |   +-- regions/            Region listing
|   |   +-- shopee/             Shopee ranking + achadinhos read/patch  (NEW)
|   |   +-- support-email/      Support request
|   |   +-- transcripts/        Video transcript endpoints
|   |   +-- trending/           Trending aggregated endpoints
|   |   +-- usage/              Usage consumption endpoint
|   |   +-- user/               User access, consent, erasure
|   |   +-- webhooks/hotmart/   Hotmart webhook receiver
|   +-- components/             Shared React components (71 .tsx files)
|   |   +-- admin/              Admin panel components
|   |   |   +-- ShopeeAdminTab.tsx        Achadinhos curation tab        (NEW)
|   |   |   +-- shopee/ShopeeConfigTab.tsx  Credentials + tuning form    (NEW)
|   |   +-- cards/              Video, product cards
|   |   +-- dashboard/          Layout: header, sidebar, guard
|   |   +-- filters/            Category and time range filters
|   |   +-- landing/            Landing page sections
|   |   +-- layout/             App header, notifications, quota display
|   |   +-- shopee/             Shopee cards, modals, dropdown           (NEW)
|   |   +-- ui/                 Generic: Logo, Skeleton, CookieBanner
|   |   +-- videos/             Insight, transcript, player modals
|   +-- dashboard/              Dashboard pages (App Router)
|   |   +-- admin/              Admin panel pages
|   |   +-- config/             User settings/profile
|   |   +-- creators/           Creators ranking page
|   |   +-- home/               Dashboard home
|   |   +-- influencer-ia/      Influencer IA wizard page
|   |   +-- products/           Products ranking page
|   |   +-- prompt-library/     Prompt library page
|   |   +-- shopee/             Shopee vertical                          (NEW)
|   |   |   +-- ranking/        Shopee best-seller ranking page
|   |   |   +-- achadinhos/     Achadinhos video feed page
|   |   +-- suporte/            Support page
|   |   +-- trends/             Trends page
|   |   +-- videos/             Videos ranking page
|   |   +-- (saved pages)       Saved videos, saved products
|   +-- data/                   Static data modules
|   +-- login/                  Login page
|   +-- page.tsx                Landing page (public)
|   +-- layout.tsx              Root layout (providers)
|   +-- providers.tsx           Session + MUI theme providers
+-- lib/                        Business logic and service layer (102 .ts files)
|   +-- access/                 Access resolution (subscription vs grant)
|   |   +-- resolver.ts         Computes effective user access
|   +-- admin/                  Admin-specific logic
|   +-- auth.ts                 NextAuth config + requireAuth/requireAdmin helpers
|   +-- avatar-video/           Avatar video creation flow logic
|   +-- categories.ts           Category utilities
|   +-- crypto.ts               AES-256-GCM encryption for secrets
|   +-- echotik/                EchoTik API client and cron logic
|   |   +-- client.ts           HTTP client (Basic auth); hashtag video list
|   |   |                       and video captions endpoints             (EXTENDED)
|   |   +-- trending.ts         Trending data fetchers
|   |   +-- cron/               Cron job runner
|   |   +-- admin/              Admin EchoTik management
|   +-- email/                  Email sending via Resend
|   +-- exchange/               Exchange rate fetching/storage
|   +-- filters/                Filter helpers for dashboard queries
|   +-- format.ts               Number/currency formatting
|   +-- hotmart/                Hotmart integration
|   |   +-- client.ts           HTTP client (OAuth2)
|   |   +-- config.ts           Config constants
|   |   +-- oauth.ts            Token management
|   |   +-- plans.ts            Plan sync
|   |   +-- processor.ts        Webhook event processor
|   |   +-- webhook.ts          Webhook verification + routing
|   +-- influencer-ia/          Influencer IA wizard logic
|   +-- insight/                Video insight generation
|   +-- lgpd/                   LGPD consent and erasure
|   +-- logger.ts               Structured logger (console-based)
|   +-- prisma.ts               Prisma client singleton
|   +-- prompt-library/         Prompt library queries
|   +-- region.ts               Region/country utilities
|   +-- settings.ts             Dynamic settings (key-value from DB)
|   +-- shopee/                 Shopee integration module                (NEW)
|   |   +-- shopee-api-client.ts  GraphQL client, SHA-256 signing (333 L)
|   |   +-- client.ts             Ranking sync + EchoTik mapping  (329 L)
|   |   +-- pipeline.ts           Achadinhos AI pipeline          (825 L)
|   |   +-- types.ts              DTOs, defaults, GPT prompts     (129 L)
|   |   +-- adapters.ts           Shopee DTO -> TikTok DTO        (104 L)
|   |   +-- shopee-categories.ts  productCatIds -> names          (210 L)
|   |   +-- cron/syncShopee.ts    Frequency gating + orchestration(175 L)
|   +-- storage/                Vercel Blob integration
|   +-- swr/                    SWR hooks for client data fetching
|   |   +-- useShopee.ts        Shopee ranking/achadinhos hooks          (NEW)
|   +-- sync/                   DB sync utilities
|   +-- transcription/          Video transcription pipeline
|   |   +-- service.ts          Orchestration: create/status/queue
|   |   +-- whisper.ts          OpenAI Whisper integration
|   |   +-- media.ts            Download URLs, buffers, EchoTik captions,
|   |                           parseCaptionToPlainText              (EXTENDED)
|   +-- types/                  Shared TypeScript types
|   +-- usage/                  Usage tracking and quota enforcement
|   |   +-- consume.ts          Atomic usage consumption
|   |   +-- enforce.ts          Quota assertions
|   |   +-- period.ts           Monthly period management
|   |   +-- quota.ts            Plan quota definitions
|   +-- useViewMode.ts          Card/list view-mode hook
+-- prisma/                     Database schema and migrations
|   +-- schema.prisma           Single source of truth (42 models)
|   +-- migrations/             33 sequential migrations
|   +-- seed.ts                 DB seed script
|   +-- cleanupAchadinhos.ts    One-off purge of sub-30k-view achadinhos (NEW)
+-- __tests__/                  Test suites (88 unit/component test files)
|   +-- api/                    API route integration tests
|   +-- components/             React component unit tests
|   +-- lib/                    Library unit tests
|   +-- helpers/                Test utilities and factories
+-- e2e/                        Playwright specs (login, smoke)
+-- docs/                       Project documentation (deploy, auth, etc.)
+-- openspec/                   OpenSpec change tracking
+-- scripts/                    One-off admin/diagnostic scripts
+-- types/                      Global TypeScript declarations
+-- middleware.ts               Edge middleware (auth + CSP)
+-- next.config.js              Next.js configuration
+-- vercel.json                 Vercel deployment config (5 cron entries)
+-- vitest.config.ts            Vitest (node) test config
+-- vitest.component.config.ts  Vitest (jsdom) test config
+-- playwright.config.ts        Playwright E2E config
```

## Design Patterns

### Repository Pattern (light)
- **Location**: `lib/` modules (e.g., `lib/hotmart/processor.ts`, `lib/access/resolver.ts`, `lib/shopee/client.ts`)
- **Purpose**: Encapsulates DB queries and business logic away from API route handlers
- **Implementation**: Each domain has its own `lib/` subdirectory with service functions

### Auth Guard Pattern
- **Location**: `lib/auth.ts` (`requireAuth`, `requireAdmin`, `isAuthed`)
- **Purpose**: Consistent auth/authz enforcement at the start of every API handler
- **Implementation**: Helper functions return either session data or a `NextResponse` error, checked with type guard `isAuthed()`

### Idempotency via Unique Keys
- **Location**: `HotmartWebhookEvent`, `UsageEvent`, `VideoTranscript`, `ShopeeAchadinhoProduct.videoExternalId`, `ShopeeProductTrend.productExternalId`
- **Purpose**: Prevents duplicate processing of events and duplicate ingestion of the same video/product
- **Implementation**: SHA-256 hash of event identity fields, or a natural external ID, declared `@unique` and driven through `upsert`

### Access Resolution Strategy
- **Location**: `lib/access/resolver.ts`
- **Purpose**: Compute effective access from multiple sources with clear priority
- **Implementation**: Priority chain: UserStatus (SUSPENDED blocks all) > AccessGrant (admin override) > SubscriptionStatus

### Soft Delete (LGPD)
- **Location**: `User.deletedAt`, middleware enforcement
- **Purpose**: LGPD data erasure without destroying audit trail
- **Implementation**: `deletedAt` set on deletion; middleware blocks deleted users from accessing app

### Domain-Isolated API Namespaces
- **Location**: `app/api/admin/` (admin-only), `app/api/cron/` (cron-only), `app/api/me/` (user-profile)
- **Purpose**: Logical separation of API surface by actor type
- **Implementation**: Middleware enforces ADMIN role for `/api/admin/*`; cron routes check `CRON_SECRET` with `timingSafeEqual` and refuse to run outside Vercel

### Frequency-Gated Cron via Ingestion Runs *(new)*
- **Location**: `lib/shopee/cron/syncShopee.ts` (`shouldSkipShopeeTask`)
- **Purpose**: Decouple the *schedule* (fixed 6h in `vercel.json`) from the *effective cadence* (admin-configurable hours), and keep external API cost down
- **Implementation**: Before running, query `IngestionRun` for a `SUCCESS` row with the same `source` inside the configured window; if found, skip. Every run writes a `RUNNING` → `SUCCESS`/`FAILED` record with `statsJson`. A `?force=true` query param bypasses the gate.

### Adapter Pattern *(new)*
- **Location**: `lib/shopee/adapters.ts`
- **Purpose**: Reuse the existing TikTok `ProductCard` / `VideoCard` / `TikTokPlayerModal` components for Shopee data without modifying them
- **Implementation**: `toProductDTO()` and `toVideoDTO()` project `ShopeeProductTrendDTO` / `ShopeeAchadinhoDTO` onto the canonical `ProductDTO` / `VideoDTO` shapes, zero-filling metrics Shopee does not provide

### Graceful-Degradation Chain *(new)*
- **Location**: `lib/shopee/pipeline.ts`
- **Purpose**: Keep a long, multi-vendor pipeline running when any single hop fails
- **Implementation**: Layered fallbacks — captions → Whisper; short link → offer link → Shopee search URL; hashtag ID from option → env → Setting → constant. Each video is isolated in `try`/`catch` and a failure marks that record `FAILED` and `continue`s.

### Defensive BigInt Serialization *(new)*
- **Location**: `app/api/shopee/achadinhos/route.ts`, `app/api/shopee/achadinhos/[id]/route.ts` (`serializeAchadinho`)
- **Purpose**: `NextResponse.json` cannot serialize `bigint` (`views` is `BigInt`)
- **Implementation**: Walks every field of the record and converts any `bigint` to `Number` before responding, so future BigInt columns do not break the endpoint

## Existing Files Inventory (Key Files)

### Auth & Security
- `middleware.ts` — Edge middleware: auth enforcement, nonce-based CSP (Shopee CDN hosts allowed), role checks
- `lib/auth.ts` — NextAuth config (credentials provider, JWT callbacks, rate limiting)
- `lib/crypto.ts` — AES-256-GCM encryption/decryption for stored API secrets

### Core Access Control
- `lib/access/resolver.ts` — Resolves effective user access (FULL_ACCESS / GRACE_PERIOD / NO_ACCESS / SUSPENDED)

### Billing Integration
- `lib/hotmart/webhook.ts` — Webhook receiver and HMAC verification
- `lib/hotmart/processor.ts` — Subscription lifecycle processor (create, renew, cancel)
- `lib/hotmart/client.ts` — Hotmart REST API client (OAuth2)
- `app/api/webhooks/hotmart/route.ts` — Hotmart webhook endpoint

### Trending Data (TikTok)
- `lib/echotik/client.ts` — EchoTik HTTP client; also `fetchVideosByHashtag()` and `fetchVideoCaptions()`
- `lib/echotik/trending.ts` — Trending data fetch helpers
- `app/api/cron/echotik/route.ts` — Cron ingestion entry point
- `app/api/trending/videos|products|creators/route.ts` — Trending APIs

### Shopee *(new)*
- `lib/shopee/shopee-api-client.ts` — Shopee Affiliate GraphQL client; `searchShopeeProductsGraphQL()`, `generateShortLink()`, `findBestShopeeOffer()`, SHA-256 signing, `normalizeImageUrl()`
- `lib/shopee/client.ts` — `syncShopeeRankings()`, `getAchadinhosHashtagId()`, `mapAwemeListToVideos()`, `parseViewsFromEchoTikItem()`
- `lib/shopee/pipeline.ts` — `processAchadinhosPipeline()`, `saveAchadinhoFromPipelineItem()`, `processAchadinhoVideoFast()`, `extractProductName()`, `getTranscriptWithFallback()`, `buildCanonicalTikTokUrl()`
- `lib/shopee/cron/syncShopee.ts` — `runShopeeRankingsCron()`, `runShopeeAchadinhosCron()`
- `lib/shopee/types.ts` — `SHOPEE_DEFAULTS`, `RANKING_KEYWORDS`, GPT extraction prompt builder, fallback link builder
- `lib/shopee/adapters.ts` / `lib/shopee/shopee-categories.ts` — DTO and category mapping
- `lib/swr/useShopee.ts` — `useShopeeRanking()`, `useShopeeAchadinhosFeed()`, `useShopeeAchadinhos()`, `useUpdateAffiliateLink()`
- `app/api/cron/shopee/route.ts` — cron entry point (`?task=ranking|achadinhos|all`, `?force`, `?count`)
- `app/api/shopee/ranking/route.ts`, `app/api/shopee/achadinhos/route.ts`, `app/api/shopee/achadinhos/[id]/route.ts`
- `app/api/admin/settings/shopee/route.ts` — credentials + tuning
- `prisma/cleanupAchadinhos.ts` — one-off purge of records below the 30k-view threshold

### AI Features
- `lib/transcription/service.ts` — Transcript creation and status management
- `lib/transcription/whisper.ts` — OpenAI Whisper integration
- `lib/transcription/media.ts` — `getVideoCaptions()`, `getVideoDownloadUrl()`, `downloadVideoBuffer()`, `parseCaptionToPlainText()`
- `lib/insight/` — AI insight generation (OpenAI/Gemini)
- `lib/influencer-ia/` — Influencer IA wizard logic
- `lib/avatar-video/` — Avatar video creation flow

### Usage & Quota
- `lib/usage/quota.ts` — Quota limits per plan
- `lib/usage/enforce.ts` — `assertQuota()` — throws QuotaExceededError if limit reached
- `lib/usage/consume.ts` — Atomic usage event recording
- `lib/usage/period.ts` — Monthly usage period management

### Database
- `prisma/schema.prisma` — Complete data model (**42 models**, 33 migrations)
- `lib/prisma.ts` — Prisma client singleton (avoids hot-reload leaks in dev)
- `lib/settings.ts` — Dynamic settings from `Setting` key-value table, including the eight `shopee.*` keys

### Admin
- `app/api/admin/` — All admin API routes
- `app/components/admin/` — Admin UI components, including `ShopeeAdminTab` and `shopee/ShopeeConfigTab`
- `app/dashboard/admin/page.tsx` — Admin panel page (tabs: Assinantes, Custos, Shopee, …)

## Critical Dependencies

### @prisma/client — 5.22.0
- **Usage**: All DB access throughout `lib/` and `app/api/`
- **Purpose**: Type-safe ORM for PostgreSQL

### next-auth — 4.24.13
- **Usage**: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, all API routes via `requireAuth()`
- **Purpose**: Session management, JWT tokens, credentials authentication

### @google/genai — 2.1.0
- **Usage**: `lib/influencer-ia/`, `lib/avatar-video/`
- **Purpose**: Google Gemini API for content generation

### @vercel/blob — 2.3.3
- **Usage**: `lib/storage/`, cron jobs, API routes for image upload
- **Purpose**: Object storage for binary assets

### bcryptjs — 3.0.3
- **Usage**: `lib/auth.ts` (password verification), `app/api/auth/` (password setup/reset)
- **Purpose**: Secure password hashing

### node:crypto (built-in)
- **Usage**: `lib/crypto.ts` (AES-256-GCM), `lib/hotmart/webhook.ts` (HMAC), `lib/shopee/shopee-api-client.ts` (SHA-256 request signing), cron routes (`timingSafeEqual`)
- **Purpose**: All signing, verification, and secret encryption — no third-party crypto dependency
