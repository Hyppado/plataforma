# Copilot Instructions — Hyppado

## Product

Hyppado is a TikTok Shop intelligence SaaS.
It helps users discover trending videos, products, and creators, filtered by region and time period.
Access is authenticated and part of the experience depends on subscription/access control via Hotmart.

## Branding

- The only brand names allowed in this project are **Hyppe** and **Hyppado**.
- Do not introduce, reference, or use any other brand name, trademark, or product name in code, comments, prompts, UI text, or documentation.
- Feature names must follow the pattern: "Insight Hyppado", "Hyppado Trends", etc.
- Never create brand neologisms or adopt external brand terminology (e.g. no "VYRAL", no "Copilot", no third-party feature names used as our own).
- This applies to all layers: database comments, service docstrings, prompt templates, UI labels, commit messages, and documentation.

## Purpose of These Instructions

This file is the **authoritative source of truth** for how this project is structured, maintained, and evolved.

Before proposing or implementing any change, **always read and follow these instructions**.
Before introducing a new pattern, tool, or abstraction, check whether an existing convention already covers it.
Do not introduce unnecessary complexity.

Key principles:

- Schema changes must consider Vercel Preview and Production environments first.
- Local DB is **not** the primary migration target — Vercel environments are.
- Migration workflow must not be improvised.
- Any schema change must update migration flow, deploy flow, and docs if relevant.
- Preserve decisions that are already correct.

## Git Workflow

- Work on the `develop` branch.
- A GitHub Action (`.github/workflows/auto-deploy.yml`) automatically fast-forwards `main` to `develop` after CI passes on every push to `develop`.
- Do not push directly to `main`, except for critical hotfixes.
- Fast-forward means `main` advances to the exact same SHA as `develop` — no merge commits, no rebased copies, no divergence.
- `git pull` on any local branch always works cleanly after deploy.
- If `develop` has diverged from `main` (e.g. after a hotfix on `main`), the workflow fails and instructs the developer to rebase `develop` onto `main` locally.
- Use conventional commits:
  - `feat:`
  - `fix:`
  - `security:`
  - `refactor:`
  - `test:`
  - `chore:`

## Stack

- Next.js 14.1.0 with App Router
- MUI v5 (emotion/styled, dark-first)
- Prisma 5.22.0
- PostgreSQL with Neon in production
- NextAuth 4.24.13
- SWR 2.4.1 (client-side data fetching)
- Vitest 4.1.0 + Testing Library + Playwright 1.58.2
- Deployed on Vercel (functions with 60s limit)
- Main integrations: Echotik and Hotmart

## Current Project Structure

```
app/
  api/             → route handlers (thin — logic goes to lib/)
    admin/         → protected admin routes (14 sub-routes)
      access-grants/
      audit-logs/
      echotik/         → echotik config + health admin endpoints
      erasure-requests/
      hotmart/         → Hotmart admin endpoints
        plans/         → plan sync from Hotmart API
        product/       → product ID setting
      notifications/   → admin notification list + [id] detail
      plans/
      prompt-config/
      quota-policy/
      quota-usage/
      settings/
      subscribers/
      subscription-metrics/
      users/
      webhook-events/
    auth/          → NextAuth handlers
      reset-password/ → public password reset request (POST — no auth, no enumeration)
      setup-password/ → public token validation + password setting (GET + POST)
    cron/          → cron endpoints (echotik, sync-db, transcribe)
    echotik/       → Echotik data endpoints
    insights/      → on-demand video insight (POST + GET [videoExternalId])
    me/            → authenticated user profile
    proxy/         → external image proxy
    regions/       → active regions
    transcripts/   → on-demand transcript request + status
    trending/      → trending data
    usage/         → user quotas
    user/          → user data
    webhooks/      → external webhooks (Hotmart)
  components/
    BrandLogo.tsx  → responsive logo component (uses next/image)
    admin/         → admin area components
      echotik/       → EchotikTab (region, health, config)
      hotmart/       → HotmartTab (product ID, webhook, plan sync + quota editing)
      notifications/ → NotificationsTab (admin notification inbox)
      openai/        → OpenAITab (API key mgmt)
      users/         → UsersTab (user management table with per-user actions dropdown)
    cards/         → video, product, creator, rank cards
    dashboard/     → authenticated dashboard components
      ForcePasswordChange.tsx → full-screen modal forcing temporary password change
      PasswordChangeGuard.tsx → session-aware guard that renders ForcePasswordChange when needed
    filters/       → CategoryFilter, TimeRangeSelect etc.
    landing/       → landing page components
    layout/        → shared layout (sidebar, header)
    ui/            → reusable primitives (Logo, etc.)
    videos/        → video-specific components (TranscriptDialog, InsightDialog)
  dashboard/       → authenticated pages (/dashboard/*)
    admin/         → admin panel pages
    config/        → user settings
    creators/      → creator ranking
    products/      → product ranking
    produtos-salvos/ → saved products
    suporte/       → support page
    trends/        → trend analysis
    videos/        → video ranking
    videos-salvos/ → saved videos
  criar-senha/     → public password creation page (onboarding + reset)
  recuperar/       → public password reset request page (email form)
  login/           → login page
  theme.ts         → centralized MUI theme
lib/
  access/          → access control (AccessGrant, subscription)
    resolver.ts    → resolveAccess() — runtime access chain
  admin/           → admin services
    admin-client.ts
    config.ts      → admin config (quota policy, prompt templates, model settings)
    notifications.ts  → createNotificationIfNeeded, createDirectNotification, NOTIFICATION_RULES
    useQuotaUsage.ts
  crypto.ts        → AES-256-GCM encrypt/decrypt for secret settings
  auth.ts          → NextAuth config + callbacks
  categories.ts    → category mapping
  email/           → transactional email (Resend)
    client.ts      → Resend client singleton, sendEmail(), EMAIL_FROM/EMAIL_REPLY_TO
    templates.ts   → HTML email templates (onboarding)
    setup-token.ts → secure token generation, validation, consumption (SHA-256)
    onboarding.ts  → sendOnboardingEmail() orchestrator
    index.ts       → public re-exports
  echotik/
    client.ts      → HTTP client for Echotik API
    admin/         → admin-facing echotik services
      estimation.ts
      health.ts
    cron/          → ingestion cron modules
      orchestrator.ts  → detectNextTask() → {task, region} | null
      helpers.ts       → getConfiguredRegions(), cleanupStaleRuns(), hasExcessiveFailures(), shouldSkip()
      syncVideos.ts    → syncVideoRanklist(runId, region, log)
      syncProducts.ts  → syncProductRanklist(runId, region, log)
      syncCreators.ts  → syncCreatorRanklist(runId, region, log)
      syncCategories.ts
      uploadImages.ts  → uploadPendingImages(log, deadlineMs) — signs CDN URLs + uploads to Vercel Blob
      cacheDownloadUrls.ts → cachePendingDownloadUrls(log, deadlineMs) — pre-fetches video download URLs
      cleanupOrphans.ts → cleanupOrphanedBlobs(log) — deletes orphaned blobs and product detail rows
      config.ts        → cron configuration
      index.ts
      types.ts
    dates.ts / products.ts / rankFields.ts / trending.ts
  filters/         → shared filter utilities
    timeRange.ts
  format.ts        → number, date, currency formatters
  hotmart/
    client.ts / config.ts / oauth.ts
    plans.ts           → Hotmart plan API, sync, resolveOrSyncPlan
    processor.ts       → webhook event processing
    webhook.ts
  insight/           → on-demand AI video insight system
    index.ts       → public re-exports
    service.ts     → requestInsight, getInsight
    generate.ts    → generateInsight, parseInsightResponse (OpenAI Chat Completions)
  lgpd/            → consent and personal data (GDPR)
    erasure.ts     → data erasure request handling
  logger.ts        → createLogger(source, correlationId) → structured Logger
  prisma.ts        → PrismaClient singleton (ALWAYS use this)
  region.ts        → region helpers
  settings.ts      → database-backed configuration + secret encryption helpers
  storage/         → file storage
    saved.ts       → saved items storage
    blob.ts        → Vercel Blob helpers (sign + download + upload + delete + list images)
  transcription/   → on-demand video transcription system (Whisper-only pipeline)
    index.ts       → public re-exports
    service.ts     → requestTranscript, getTranscript, processPendingTranscripts, detectHallucination
    media.ts       → Echotik download URL retrieval + video buffer download
    whisper.ts     → OpenAI Whisper API transcription (active)
  swr/
    fetcher.ts     → default SWR fetcher
    useCategories.ts
    useTrending.ts
  types/
    admin.ts       → admin area types
    dto.ts         → shared DTOs
    echotik.ts     → Echotik API types
    echotik-admin.ts → Echotik admin-specific types
  usage/           → quota and plan limit logic
    consume.ts     → consumeUsage()
    enforce.ts     → enforceQuota()
    period.ts      → period management
    quota.ts       → quota resolution
    index.ts
prisma/
  schema.prisma    → Prisma schema (see Database Schema section)
  seed.ts          → seed with default regions BR, US, JP
__tests__/
  helpers/
    auth.ts        → auth mocking helpers
    factories.ts   → test data factories
    prisma-mock.ts → Prisma mock setup
  api/
    admin/         → admin route tests (12 files)
      access-grants.test.ts
      audit-logs.test.ts
      echotik-config.test.ts
      echotik-health.test.ts
      echotik-regions.test.ts
      echotik-tab-integration.test.ts
      notifications.test.ts
      openai-settings.test.ts
      plans.test.ts
      subscribers.test.ts
      subscription-metrics.test.ts
      users.test.ts
      users-id.test.ts
    cron/
      echotik.test.ts
      transcribe.test.ts
    me/
      alerts.test.ts
      collections.test.ts
      notes.test.ts
      saved.test.ts
    auth/
      reset-password.test.ts
      setup-password.test.ts
    webhooks/
      hotmart.test.ts
    transcripts/
      transcripts.test.ts
  components/      → RTL component tests (jsdom)
    setup.tsx      → setup: jest-dom, mocks for MUI/Next/auth
    CategoryFilter.test.tsx
    LoginPage.test.tsx
    Logo.test.tsx
    RankBadge.test.tsx
    TimeRangeSelect.test.tsx
    VideoCardSkeleton.test.tsx
  lib/
    auth.test.ts
    crypto.test.ts
    logger.test.ts
    access/
      resolver.test.ts
    admin/
      admin-client.test.ts
      notifications.test.ts
    email/
      client.test.ts
      onboarding.test.ts
      password-reset.test.ts
      setup-token.test.ts
      templates.test.ts
    echotik/
      client.test.ts
      cron-config.test.ts
      cron-helpers.test.ts
      cron-orchestrator.test.ts
      cron-scheduling.test.ts
      cron-syncCategories.test.ts
      cron-syncCreators.test.ts
      cron-syncProducts.test.ts
      cron-syncVideos.test.ts
      dates.test.ts
      estimation.test.ts
      products.test.ts
    hotmart/
      client.test.ts
      oauth.test.ts
      plans.test.ts
      processor.test.ts
      webhook.test.ts
    insight/
      generate.test.ts
      service.test.ts
    lgpd/
      erasure.test.ts
    transcription/
      media.test.ts
      service.test.ts
    usage/
      usage.test.ts
  middleware.test.ts
  security.test.ts
  setup.ts
e2e/
  smoke.spec.ts    → smoke tests: public routes + auth redirect
  login.spec.ts    → login form interaction tests
middleware.ts      → route protection for /dashboard/* and /api/admin/*
playwright.config.ts
vitest.config.ts              → node config (lib/api tests)
vitest.component.config.ts    → jsdom config (React component tests)
.github/
  workflows/
    ci.yml         → CI: typecheck → unit+component → build → e2e-smoke
```

## Database Schema (Prisma Models)

The Prisma schema is in `prisma/schema.prisma`. Current models:

### Domain 1 — Identity & IAM

- **User** — central identity; has role, status, LGPD fields, soft delete (`deletedAt`), setup token (`setupToken` + `setupTokenExpiresAt`) for password creation, `mustChangePassword` flag for admin-issued temporary passwords
- **AccessGrant** — admin-issued access overrides (replaces subscription requirement)
- **ConsentRecord** — append-only LGPD consent log
- **DataErasureRequest** — LGPD erasure request tracking
- **Invitation** — user invitation with secure token, plan pre-assignment

### Domain 2 — Plans & Billing

- **Plan** — subscription plans with quotas, features, pricing, periodicity (provider-agnostic — no Hotmart-specific fields)
  - Optional `hotmartPlanCode` (@unique) links a Plan to a Hotmart plan code for automatic provisioning
- **Subscription** — origin-agnostic subscription (source: hotmart/manual/invite/stripe)
- **HotmartSubscription** — Hotmart-specific subscription details (linked 1:1 to Subscription)
- **SubscriptionCharge** — payment records per subscription
- **ExternalAccountLink** — links User to external provider identity (Hotmart subscriberCode, etc.)

### Domain 3 — Hotmart Events

- **HotmartWebhookEvent** — raw webhook event with idempotency key, processing status, retry count

### Domain 4 — Admin & Observability

- **AdminNotification** — admin inbox notifications with severity, dedup, relations to User/Subscription/Event
- **AuditLog** — admin action audit trail
- **Setting** — dynamic key-value configuration (admin panel)

### Domain 5 — Echotik / TikTok Shop Data

- **EchotikCategory** — TikTok Shop L1 categories
- **EchotikVideoTrendDaily** — daily video ranking snapshots
- **EchotikProductTrendDaily** — daily product ranking snapshots
- **EchotikCreatorTrendDaily** — daily creator ranking snapshots
- **EchotikProductDetail** — cached product detail (enrichment)
- **EchotikRawResponse** — raw API responses (debug/reproducibility)
- **IngestionRun** — cron execution tracking (status, timing, stats)
- **Region** — active regions/countries (code PK: "BR", "US", etc.)

### Domain 6 — User Content

- **SavedItem** — user saved videos/products
- **Collection** / **CollectionItem** — user collections
- **Note** — user notes on content
- **Alert** — user alerts

### Domain 7 — Usage Tracking

- **UsagePeriod** — monthly usage aggregation per user
- **UsageEvent** — atomic consumption events with idempotency key

### Domain 8 — Transcription

- **VideoTranscript** — on-demand video transcript (one per videoExternalId, shared globally)
  - Status lifecycle: PENDING → PROCESSING → READY | FAILED
  - Source: "openai" (Whisper) — fully synchronous pipeline
  - Pipeline: Echotik download-url → download video → OpenAI Whisper → hallucination check
  - Stores plain text + optional JSONB segments with timestamps

### Domain 9 — Video Insights

- **VideoInsight** — user-specific AI insight generated from a video transcript (one per user per video)
  - Status lifecycle: PENDING → PROCESSING → READY | FAILED
  - Structured output: contextText, hookText, problemText, solutionText, ctaText, copyWorkedText
  - Stores rawResponseJson (debug), promptVersion, tokensUsed
  - Relations: User (cascade delete)
  - Unique constraint: `[userId, videoExternalId]`

### Key Enums

- `UserRole`: ADMIN, USER
- `UserStatus`: ACTIVE, INACTIVE, SUSPENDED
- `SubscriptionStatus`: PENDING, ACTIVE, PAST_DUE, CANCELLED, EXPIRED
- `ChargeStatus`: PENDING, PAID, REFUNDED, CANCELLED, CHARGEBACK, FAILED
- `WebhookStatus`: RECEIVED, PROCESSING, PROCESSED, FAILED, DUPLICATE
- `IngestionStatus`: RUNNING, SUCCESS, FAILED
- `NotificationSeverity`: INFO, WARNING, HIGH, CRITICAL
- `NotificationStatus`: UNREAD, READ, ARCHIVED
- `ErasureStatus`: PENDING, IN_PROGRESS, COMPLETED, REJECTED
- `InvitationStatus`: PENDING, ACCEPTED, EXPIRED, CANCELLED
- `PlanPeriod`: MONTHLY, ANNUAL
- `UsageEventType`: TRANSCRIPT, SCRIPT, INSIGHT
- `TranscriptStatus`: PENDING, PROCESSING, READY, FAILED
- `InsightStatus`: PENDING, PROCESSING, READY, FAILED

## Mandatory Code Rules

- Always use the Prisma singleton from `lib/prisma.ts`.
- Never create `new PrismaClient()` in handlers, pages, or new services.
- Every admin route must have server-side protection.
- Every API route must handle errors with a consistent JSON response.
- Code language must be English: variables, functions, types, internal names.
- UI text may remain in Portuguese.
- Do not use `any` in domain types when a typed alternative exists.
- Prefer existing DTOs and types from `lib/types/`.

## API Route Rules

- Route handlers must be thin.
- Business logic must go to `lib/<domain>/`.
- API routes must not concentrate complex business logic.
- Always use `try/catch`.
- Error responses must follow the JSON pattern with an `error` field.
- Do not duplicate business rule validation in the route if it already exists in the service.
- Imports inside route handlers must use the `@/` alias — never relative paths (`../../../../lib/...`).

## Architecture — Where Things Go

- Business logic: `lib/<domain>/`
- External integrations: inside the corresponding domain in `lib/`
- Route handlers: `app/api/<domain>/`
- Visual components: `app/components/<category>/`
- Shared SWR hooks: `lib/swr/`
- Shared types: `lib/types/dto.ts`, `lib/types/admin.ts`, `lib/types/echotik.ts`, `lib/types/echotik-admin.ts`
- Database-backed configuration: `lib/settings.ts` and related services

## Auth and Access

### Global Rule — Nothing Is Public

- **Every route in `app/api/**` requires server-side authentication\*\*, without exception.
- The mandatory pattern for private routes is:
  ```ts
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth; // returns 401
  ```
- For admin routes, use `requireAdmin()` (returns 401 if unauthenticated, 403 if not admin).
- Do not rely on middleware alone: every route must have an internal guard.
- Do not create a public route without a formal, documented decision.

### Valid Exceptions to Session Authentication

- **External webhooks** (e.g. `/api/webhooks/hotmart`) — do not use NextAuth sessions.
  Must have strong own signature/origin validation (HMAC or official header).
  Treat all input as untrusted. Apply idempotency.
- **Cron routes** (`/api/cron/*`) — authenticated by `CRON_SECRET` in the `Authorization: Bearer` header.
  Do not accept user sessions. Do not expose to the browser.
  **Blocked in local environment**: all cron routes check for the `VERCEL` env var (set automatically by Vercel). If absent, the route returns 403 immediately — no cron logic executes locally. This prevents accidental data mutations against the shared Neon database from a dev machine.
- **NextAuth handler** (`/api/auth/[...nextauth]`) — managed internally by NextAuth.
- **Password reset** (`/api/auth/reset-password`) — public POST, receives `{ email }`, always returns 200.
  Must NEVER reveal whether the email exists. No timing side-channels.

### Auth Helpers (`lib/auth.ts`)

- `requireAuth()` — returns `{ session, userId, role }` or `NextResponse 401`
- `requireAdmin()` — returns `{ session, userId, role }` or `NextResponse 401/403`
- `isAuthed(result)` — type guard to distinguish success from an error response

### Middleware

- The middleware (`middleware.ts`) protects `/dashboard/*` and `/api/admin/*` at the routing level.
- For all other routes in `app/api/`, authentication is enforced by the internal guard.
- Both mechanisms are complementary — they do not replace each other.

### Access Chain

1. User status blocks access if suspended/deleted
2. `AccessGrant` can grant an override
3. Active subscription grants access
4. Fallback: no access

- Do not persist derived access state if it can be correctly resolved at runtime.
- Do not create new authorization bypasses outside the existing pattern.

## Quotas and Usage

- All quota logic must go through `lib/usage/`.
- Do not duplicate plan limit logic.
- Do not re-implement quota calculations in components, pages, or handlers.
- Quota consumption must remain idempotent.
- To change per-plan limits, centralize in the correct point of the usage domain.

## Echotik Integration — Cron and Ingestion

The cron was refactored to a modular, region-scoped architecture to respect the Vercel 60s limit.

### Critical Rule — No Live Echotik API Calls from User-Facing Routes

**No API route or page may call the Echotik external API (`echotikRequest`) to serve user data.**
All user-facing data (videos, products, creators, categories, images) must come from the database or Vercel Blob, pre-ingested by the cron.

- `echotikRequest` (from `lib/echotik/client.ts`) must ONLY be used by:
  - **Cron ingestion modules** in `lib/echotik/cron/` — this is the intended data path
  - **Image upload cron** (`lib/echotik/cron/uploadImages.ts`) — signs CDN URLs + uploads to Vercel Blob
  - **Download URL caching cron** (`lib/echotik/cron/cacheDownloadUrls.ts`) — pre-fetches video download URLs
  - **Image proxy** (`app/api/proxy/image/`) — **DEPRECATED FALLBACK** for images not yet in Vercel Blob
  - **Transcription** (`lib/transcription/media.ts`) — **FALLBACK ONLY** when cached download URL is not available
- **Image serving**: images are stored in Vercel Blob (`@vercel/blob`). Trending routes serve `blobUrl`/`avatarBlobUrl` when available, falling back to the proxy route for not-yet-uploaded images.
- **Video download URLs**: pre-cached in `EchotikVideoTrendDaily.downloadUrl` by the cron. Transcription checks cache first, falls back to Echotik API.
- User-facing data routes (`/api/trending/*`, `/api/echotik/categories`, etc.) must **always** read from Prisma/database
- Do not create new routes or lib functions that call `echotikRequest` to serve user data
- If new Echotik data is needed, add it to the cron ingestion pipeline first, then serve from DB

- **HTTP Client**: `lib/echotik/client.ts`
- **Orchestrator**: `lib/echotik/cron/orchestrator.ts`
  - `detectNextTask(force?)` → `{ task, region } | null`
  - Iterates in priority order: categories → videos per region → products per region → creators per region → details → upload-images → cache-download-urls → cleanup-orphans
  - Skip keys in the format `echotik:videos:BR`, `echotik:products:US`, `echotik:upload-images`, `echotik:cache-download-urls`, `echotik:cleanup-orphans`, etc.
  - **Skip interval applies only to successful runs.** `shouldSkip()` checks for a FAILED run on `echotik:run:<task>:<region>` that occurred _after_ the last success — if found, returns false so the task retries immediately on the next tick, regardless of the configured interval. Persistent failures are still throttled by `hasExcessiveFailures()` (5 failures in 2h).
- **Sync functions**: each receives `(runId, region, log)` — one region per invocation
  - `syncVideoRanklist(runId, region, log)` in `syncVideos.ts`
  - `syncProductRanklist(runId, region, log)` in `syncProducts.ts`
  - `syncCreatorRanklist(runId, region, log)` in `syncCreators.ts`
  - Each sync prunes stale rows at the end: `deleteMany({ country: region, syncedAt: { lt: runStart } })` — only the current cycle survives in the trend table.
- **Post-ingestion tasks** (no region, run after all ranklists):
  - `uploadPendingImages(log, deadlineMs)` in `uploadImages.ts` — signs CDN URLs + uploads product covers and creator avatars to Vercel Blob; scoped to items in the latest ranking cycle only
  - `cachePendingDownloadUrls(log, deadlineMs)` in `cacheDownloadUrls.ts` — pre-fetches video download URLs
  - `cleanupOrphanedBlobs(log)` in `cleanupOrphans.ts` — runs once per 24h; deletes `EchotikProductDetail` rows (+ their Vercel Blob cover files) for products no longer in any trend row, and deletes `creators/` blob files for creators no longer in `EchotikCreatorTrendDaily`; blob deletion precedes DB deletion — any blob failure preserves the DB row for retry
- **Image storage**: `lib/storage/blob.ts` — Vercel Blob helpers
  - `uploadEchotikImageToBlob(cdnUrl, blobPath)` — sign + download + upload
  - `deleteBlobs(urls, batchSize?)` — batched blob deletion
  - `listBlobsByPrefix(prefix)` — paginated blob listing
  - Requires `BLOB_READ_WRITE_TOKEN` env var in Vercel
- **Regions**: read exclusively from the `Region` table in the database (`isActive=true`, `orderBy sortOrder`).
  Fallback to `["BR", "US", "JP"]` if the database returns empty.
  **Never use environment variables** for regions.
- **Default seed**: `prisma/seed.ts` seeds BR, US, JP.
- Endpoint: `app/api/cron/echotik/route.ts` — accepts `?task=&region=&force=`
- Do not mix ingestion, transformation, persistence, and observability in the same block.
- If adding new behavior, create a separate module in `lib/echotik/cron/`.

## Hotmart Integration

- Webhooks: `/api/webhooks/hotmart` → `lib/hotmart/processor.ts`
- Admin notifications: `lib/admin/notifications.ts`
- Provisioning: `getProvisioningPlan(fields)` matches webhook `planCode` → auto-syncs from Hotmart API if missing → fallback to first active plan by sortOrder
- Plan management: `lib/hotmart/plans.ts` — `listProducts()`, `listPlansForProduct()`, `syncPlansFromHotmart()`, `resolveOrSyncPlan()`
- Product ID: admin-configured Setting (`hotmart.product_id`) — anchor for plan discovery
- Plans sync: PlansCard auto-syncs on mount → fetches plans from Hotmart API → upserts local Plan records (creates with default quotas, updates metadata without touching quotas)
- Quotas are local-only — edited by admin in the plans table, never synced back to Hotmart
- Hotmart product/plan/offer metadata stored in `HotmartSubscription` as external reference data
- Hotmart catalog data (coupons, offers, products) is NOT mirrored locally — access via API when needed
- Subscribers list and subscription metrics are fetched directly from Hotmart API (not from local DB)
- New changes must preserve: retry, auditability, separation of reception/processing,
  compatibility with the current subscription and webhook processing flow.

### PURCHASE_APPROVED — Main Provisioning Event

- `PURCHASE_APPROVED` is the primary provisioning event for Hotmart purchases.
- Handled by the dedicated `handleApproved(webhookEventId, fields)` function in `lib/hotmart/processor.ts`.
- **Provisioning flow** (explicit steps):
  1. Resolve or create internal user + `ExternalAccountLink` via `resolveOrCreateIdentity`
  2. Reactivate INACTIVE user (purchasing implies intent); SUSPENDED stays (admin must review)
  3. Get provisioning plan via `getProvisioningPlan(fields)` — matches `planCode` via `resolveOrSyncPlan`, fallback to first active plan by sortOrder
  4. Upsert `Subscription` + `HotmartSubscription` with ACTIVE status
  5. Upsert `SubscriptionCharge` with PAID status (by transactionId)
  6. Access is runtime-driven (`lib/access/resolver.ts`) — no derived state persisted
  7. Audit log: `WEBHOOK_PURCHASE_APPROVED` (first purchase) or `WEBHOOK_PURCHASE_RENEWED` (renewal)
  8. Admin notification: `SUBSCRIPTION_ACTIVATED` for first-time purchases only; `SUSPENDED_USER_PURCHASE` if user is suspended
  9. Onboarding email: `sendOnboardingEmail({userId})` for first-time purchases only (non-renewals), `.catch()` protected — never breaks provisioning
- **Renewal**: `recurrenceNumber > 1` = renewal (no admin notification, audit action = `WEBHOOK_PURCHASE_RENEWED`)
- **Idempotency**: webhook dedup by `idempotencyKey` (UNIQUE), subscription upsert by external ID, charge upsert by transactionId, notification dedup by dedupeKey
- **User identity rule**: Hotmart is an external commercial source, NOT the primary user identity. `ExternalAccountLink` is optional/external, not identity-defining.
- Do not create new provisioning paths outside this handler for Hotmart.

### SUBSCRIPTION_CANCELLATION — Definitive Cancellation Event

- `SUBSCRIPTION_CANCELLATION` is the definitive subscription cancellation event from Hotmart.
- Handled by the generic `_processEvent` path in `lib/hotmart/processor.ts` (not a dedicated handler — uses the `CANCELLATION_EVENTS` set).
- **Payload structure** (different from purchase events):
  - `data.subscriber` is at the TOP of `data` (NOT nested under `data.subscription.subscriber`)
  - `data.cancellation_date` (epoch ms) is the actual cancellation timestamp
  - `data.subscription.id` and `data.subscription.plan` exist as normal
  - NO `data.buyer` block — subscriber IS the identity source
  - NO `data.purchase` block — no transaction or charge
- **Field extraction** (`lib/hotmart/webhook.ts`):
  - `subscriberCode` / `subscriberEmail` — from `data.subscriber` (fallback chain handles top-level subscriber)
  - `buyerName` — falls back to `subscriber.name` when no `buyer` block
  - `buyerEmail` — falls back to `subscriberEmail` when no `buyer` block
  - `cancellationDate` — extracted from `data.cancellation_date` (epoch ms)
  - `subscriptionExternalId` — from `data.subscription.id`
- **State transition**:
  1. Resolve identity via `resolveOrCreateIdentity` (uses subscriber email/code)
  2. Resolve plan via `getProvisioningPlan`
  3. Upsert subscription with `CANCELLED` status
  4. Set `cancelledAt` = `cancellationDate` (actual cancellation date, not webhook timestamp)
  5. Set `endedAt` = same date (subscription is definitively over)
  6. User is NOT deleted, NOT suspended — only subscription status changes
  7. Access revocation is runtime-driven (`lib/access/resolver.ts`)
  8. Audit log: `WEBHOOK_SUBSCRIPTION_CANCELLATION`
  9. Admin notification: `SUBSCRIPTION_CANCELLATION` (severity: WARNING)
- **Idempotency**: webhook dedup by `idempotencyKey`, subscription upsert by external ID/subscriberCode, notification dedup by dedupeKey
- **Safety**: user identity, history, saved items, and collections are preserved — only the subscription record is transitioned
- Do not add user deletion or suspension logic to cancellation handling.

### Hotmart Webhook Validation

- Hotmart uses a static token (`X-Hotmart-Hottok`) configured in the Developers → Webhooks panel.
- Validation is done in `lib/hotmart/webhook.ts` → `verifySignature(headers, rawBody)`.
- **Mandatory rules**:
  - Always compare with `timingSafeEqual` (native `crypto` module) — never `===` directly for secrets.
  - **Fail closed**: if `HOTMART_WEBHOOK_SECRET` is not configured, the request is **rejected**. No permissive fallback in any environment.
  - Error message **must not reveal** any part of the secret (not prefix, not length).
  - The `rawBody: Buffer` parameter is kept in the `verifySignature` signature to support future HMAC if Hotmart adopts it.
- Do not change the idempotency behavior (deterministic SHA-256 key via `buildIdempotencyKey`).
- Do not process the same event more than once — the `UNIQUE` constraint in the database is the guarantee.

## Transcription System

On-demand video transcription, shared globally per `videoExternalId`.
Fully synchronous — user clicks "Transcrever" and gets the result within the same request.

- **Service**: `lib/transcription/service.ts`
  - `requestTranscript(videoExternalId, userId)` — synchronous pipeline: download + Whisper + hallucination check
  - `getTranscript(videoExternalId)` — returns current status/content
  - `processPendingTranscripts()` — cron batch processor for retrying FAILED records
  - `detectHallucination(text)` — detects music-only Whisper outputs
- **Media**: `lib/transcription/media.ts` — retrieves download URLs from Echotik `/realtime/video/download-url` + downloads video buffer
- **Whisper**: `lib/transcription/whisper.ts` — OpenAI Whisper API transcription (active, primary method)
- **Encryption**: `lib/crypto.ts` — AES-256-GCM for secret settings (OpenAI API key)
- **API Routes**:
  - `POST /api/transcripts` — request transcript (consumes TRANSCRIPT quota)
  - `GET /api/transcripts/[videoExternalId]` — get status/content
  - `GET /api/cron/transcribe` — cron processor for FAILED retries (auth by CRON_SECRET)
  - `GET/POST /api/admin/settings/openai` — admin OpenAI key management
  - `POST /api/admin/settings/openai/test` — validate OpenAI key
- **Frontend**: `TranscriptDialog` in `app/components/videos/`, integrated into `VideoCard`
- **Admin UI**: `OpenAITab` in `app/components/admin/openai/`, mounted in config page (tab 3)
- **Rules**:
  - Transcripts are global — one record per video, shared across all users
  - Quota is consumed only for new requests, not reuses of existing transcripts
  - OpenAI key is server-side only — never sent to the browser
  - Pipeline is Whisper-only — Echotik captions were removed from the flow
  - Hallucination detection rejects music-only Whisper outputs
  - New transcript sources must follow the same status lifecycle (PENDING → PROCESSING → READY | FAILED)

## Insight System

On-demand AI video insights (Insight Hyppado), per-user per-video.
Fully synchronous — user clicks "Gerar Insight" and gets structured analysis within the same request.
Depends on a transcript existing (auto-generates one if needed).

- **Service**: `lib/insight/service.ts`
  - `requestInsight(videoExternalId, userId)` — synchronous pipeline: ensure transcript → OpenAI → parse → save
  - `getInsight(videoExternalId, userId)` — returns current status/content for this user
- **Generate**: `lib/insight/generate.ts` — OpenAI Chat Completions with structured output
  - `generateInsight(transcriptText, promptTemplate)` — calls OpenAI, returns raw response
  - `parseInsightResponse(content)` — parses JSON sections with `tryRepairTruncatedJson` fallback
  - Output sections: contexto, gancho, problema, solução, CTA, roteiro reutilizável
- **Index**: `lib/insight/index.ts` — public re-exports
- **API Routes**:
  - `POST /api/insights` — request insight (consumes SCRIPT quota)
  - `GET /api/insights/[videoExternalId]` — get status/content for authenticated user
- **Frontend**: `InsightDialog` in `app/components/videos/`, integrated into `VideoCard`
- **Prompt Config**: admin-configurable prompt template via `lib/admin/config.ts` → `getPromptConfigFromDB()`
- **Rules**:
  - Insights are per-user — one `VideoInsight` per `(userId, videoExternalId)`, unlike shared transcripts
  - Transcript is a prerequisite — auto-generated if missing
  - Quota is consumed from the SCRIPT allocation, not a separate INSIGHT quota
  - Structured output is stored as individual text columns, not a single blob
  - `rawResponseJson` stored for debug; `promptVersion` and `tokensUsed` tracked
  - New insight types must follow the same status lifecycle (PENDING → PROCESSING → READY | FAILED)

## Email / Onboarding / Password Reset

Transactional email via Resend for user onboarding, first-access password setup, and password reset.
Three trigger points: Hotmart PURCHASE_APPROVED (new users), admin-created users (with `sendEmail: true`), and self-service password reset (`/recuperar`).

- **Client**: `lib/email/client.ts`
  - `sendEmail(options)` — sends via Resend, returns `{success, messageId?, error?}`
  - Sender: `Hyppado <suporte@hyppado.com>` (EMAIL_FROM)
  - Reply-To: `suportehyppado@gmail.com` (EMAIL_REPLY_TO)
  - Graceful degradation: returns `{success: false}` when `RESEND_API_KEY` not set
- **Templates**: `lib/email/templates.ts`
  - `buildOnboardingEmail({name, setupUrl, expiresInHours})` → `{subject, html, text}`
  - `buildPasswordResetEmail({name, resetUrl, expiresInHours})` → `{subject, html, text}`
  - `buildWelcomePasswordEmail({name, email, password, loginUrl})` → `{subject, html, text}` (admin-created users with temp password)
  - Inline styles, dark theme, Hyppado branding, XSS-safe (escapeHtml)
  - All templates must use the `wrapTemplate()` wrapper for consistent layout
- **Token Service**: `lib/email/setup-token.ts`
  - `hashToken(raw)` → SHA-256 hex (stored in `User.setupToken`)
  - `generateSetupToken(userId, expiryHours)` → raw token (32 bytes, base64url), persists hash + expiry
  - `validateSetupToken(raw)` → hash lookup + expiry + status check
  - `consumeSetupToken(userId, passwordHash)` → sets password + clears token atomically
  - Constants: `ONBOARDING_TOKEN_EXPIRY_HOURS = 24`, `RESET_TOKEN_EXPIRY_HOURS = 1`
- **Onboarding Orchestrator**: `lib/email/onboarding.ts`
  - `sendOnboardingEmail({userId, force?})` — checks user status + password, generates 24h token, sends email
  - Duplicate protection: skips if user already has `passwordHash` (unless `force=true`)
  - URL: `{NEXTAUTH_URL}/criar-senha?token=<raw_token>`
- **Password Reset Orchestrator**: `lib/email/password-reset.ts`
  - `sendPasswordResetEmail({email})` — looks up user by email, generates 1h token, sends reset email
  - NEVER reveals whether the email exists — returns `{ok: true}` for non-existent/inactive users
  - Skips silently: user not found, user not active, user has no password (no enumeration)
  - URL: `{NEXTAUTH_URL}/criar-senha?token=<raw_token>` (reuses same page)
- **API Routes** (public — no session required):
  - `POST /api/auth/reset-password` `{email}` — always returns 200 with generic message (no enumeration)
  - `GET /api/auth/setup-password?token=<raw>` — token validation preflight (valid + email)
  - `POST /api/auth/setup-password` `{token, password}` — validates, hashes with bcrypt(10), consumes token, audit log
- **Frontend**:
  - `/recuperar` — email form for password reset request (always shows success, no enumeration)
  - `/criar-senha` — token-based password creation/reset page (Suspense-wrapped for `useSearchParams`)
  - Login page links to `/recuperar` via "Esqueceu sua senha?" link
- **Integration Points**:
  - `lib/hotmart/processor.ts` → step I in `handleApproved()`: sends onboarding for first purchases (non-renewals), `.catch()` protected
  - `app/api/admin/users/route.ts` POST: `sendEmail: true` creates user without password and sends onboarding email
  - `app/api/admin/users/[id]/route.ts` POST: admin password reset — generates temp password, sets `mustChangePassword=true`, sends `buildWelcomePasswordEmail`
  - `app/api/admin/users/[id]/route.ts` DELETE: deletes non-subscriber users with cascade cleanup + audit log
  - Login page → "Esqueceu sua senha?" → `/recuperar` → email → `/criar-senha?token=`
- **Temporary Password Flow (admin-issued)**:
  - Admin resets a user's password via POST `/api/admin/users/[id]`
  - User's `mustChangePassword` flag is set to `true` in the database
  - NextAuth JWT callback propagates `mustChangePassword` into the session token
  - `PasswordChangeGuard` renders `ForcePasswordChange` dialog when session has `mustChangePassword=true`
  - User must change password via PUT `/api/me/password` — clears `mustChangePassword` flag
  - Session reloads after password change (page reload to refresh JWT)
- **Security Properties**:
  - Only SHA-256 hash stored — raw token exists only in the email link
  - One-time use (cleared on consumption)
  - Token has configurable expiry (24h onboarding, 1h reset)
  - Generic error messages — no user/email enumeration at any point in the flow
  - Password reset API always returns 200 regardless of user existence
  - Password min length: 8 characters (server-enforced)
- **Rules**:
  - Do not send onboarding email to users who already have a password (unless force=true)
  - Do not break Hotmart provisioning if email fails — always `.catch()`
  - Do not store raw tokens in the database — store hash only
  - Do not reveal whether an email is registered during password reset — always return the same response
  - `RESEND_API_KEY` must be configured in Vercel environment variables
  - The `NEXTAUTH_URL` env var is used for building setup/reset URLs
  - New email templates must follow the existing `wrapTemplate()` pattern
  - New transactional emails must use `lib/email/client.ts` — do not create alternate email services

## Admin Notifications

Notifications generated by Hotmart events and system processes, visible to admins in the config panel.

- **Service**: `lib/admin/notifications.ts`
  - `NOTIFICATION_RULES` — maps 7 event types to severity/title/message templates
  - `EVENT_TO_NOTIFICATION_TYPE` — maps Hotmart event names to notification types
  - `buildDedupeKey()` — SHA-256 deterministic deduplication
  - `createNotificationIfNeeded(ctx)` — rule-based creation with dedup (called from `lib/hotmart/processor.ts`)
  - `createDirectNotification(type, overrides)` — for cron/system use
- **API Routes** (all admin-only via `requireAdmin()`):
  - `GET /api/admin/notifications` — paginated list with status/severity/type filters
  - `PATCH /api/admin/notifications` — bulk status update (READ/ARCHIVED/UNREAD)
  - `PATCH /api/admin/notifications/[id]` — single notification status update
  - `GET /api/admin/notifications/summary` — returns `{ unread, critical, total }`
  - `GET /api/admin/webhook-events` — paginated webhook event list with filters
  - `POST /api/admin/webhook-events` — replay webhook event
- **Frontend**: `NotificationsTab` in `app/components/admin/notifications/`, mounted in config page (tab 4)
  - SWR-powered inbox with 30s auto-refresh
  - Filters: status (all/unread/read/archived), severity color coding
  - Actions: mark read/unread, archive (single + bulk "mark all read")
  - Expandable details: user, subscription, Hotmart event, metadata
  - Summary badges: unread count, critical count
  - Recent Hotmart webhook events section for test validation
- **Rules**:
  - Notifications dedup by `dedupeKey` (SHA-256) — same event won't create duplicates
  - `processor.ts` calls `createNotificationIfNeeded()` at 3 integration points
  - Frontend is admin-only — config page requires ADMIN role
  - No raw payload exposure in the UI

## Logs and Observability

- Use `createLogger(source, correlationId)` from `lib/logger.ts` — returns a structured `Logger`.
- Never use `console.log` for loose debugging.
- Log only genuinely significant operational events.
- Preserve auditability of admin actions and relevant events.
- Do not leak secrets, tokens, or sensitive payloads in logs.
- In cron and integrations, pass the `logger` created at the start of the invocation throughout the chain.

## Admin

- The admin area must remain protected on the server.
- Services in `lib/admin/`: `admin-client.ts`, `config.ts`, `notifications.ts`, `useQuotaUsage.ts`.
- Admin API routes live in `app/api/admin/` (15 sub-routes covering users, plans, subscribers, notifications, access grants, audit logs, echotik config/health, settings, quotas, etc.).
- Do not put administrative secrets in the frontend.
- Do not use `localStorage` or `sessionStorage` to store secrets or sensitive credentials.

### Users Table (`app/components/admin/users/UsersTab.tsx`)

- Columns: Nome, Email, Perfil, Status, **Plano** (plan name only), **Assinatura** (subscription status), **Mensalidade** (last charge status), **Acesso até** (endedAt or "Em vigor"), Criado, Ações.
- Row actions are in a `⋮` dropdown (`RowActionsMenu`) — Editar, Resetar Senha, Excluir, Desativar.
- **Critical**: `_count.subscriptions` in `app/api/admin/users/route.ts` counts **all** subscriptions regardless of status. Never change this to filter by `status: 'ACTIVE'` — doing so would misclassify users with cancelled/expired subscriptions as plain users, making them wrongly deletable.
- `isEditable` (controls delete/edit availability) is derived from `getUserCategory`: a user is a `subscriber` if `_count.subscriptions > 0` (any status). ADMIN-role users are never editable via that path.

## Frontend and Components

- Do not create a new component with hundreds of lines if it can be split.
- Prefer componentization by responsibility (section, card, table, dialog, hook, helper).
- Extract reusable parts when there is real duplication.
- Do not leave complex business logic inside visual components.
- **Logo**: use `app/components/ui/Logo.tsx` (`Box component="img"`) for simple contexts
  or `app/components/BrandLogo.tsx` (`next/image` with `fill`) for responsive headers.
  Do not create a new logo component.

## Themes, Design Tokens and UI

- MUI with `sx` as the primary approach.
- Theme centralized in `app/theme.ts` — do not create a new `createTheme()`.
- Do not create scattered `UI = { ... }` objects with inline tokens.
- Maintain the existing dark-first visual consistency.
- **All colors that exist in the theme palette must be referenced via theme tokens** — never hardcode hex values that are already defined in the palette.
- Use `"primary.main"`, `"secondary.main"`, `"secondary.dark"`, etc. in `sx` props instead of raw hex strings.

### Palette Reference

| Token             | Hex       | Usage                                                                                       |
| ----------------- | --------- | ------------------------------------------------------------------------------------------- |
| `primary.main`    | `#2DD4FF` | Main brand color (cyan), links, active states                                               |
| `primary.light`   | `#6BE0FF` | Lighter variant                                                                             |
| `primary.dark`    | `#00B8E6` | Darker variant                                                                              |
| `secondary.main`  | `#FF2D78` | Accent pink — dialog titles, accent buttons, focused input borders, small detail highlights |
| `secondary.light` | `#FF5C9A` | Lighter pink variant                                                                        |
| `secondary.dark`  | `#E0256A` | Darker pink — hover states for secondary buttons                                            |

When adding new accent-colored UI, use `secondary.main` / `secondary.dark` / `secondary.light` from the theme — do not introduce new hardcoded pink hex values.

## Frontend Data Fetching

- The project uses **SWR** (`swr` 2.4.1) as the standard client-side data fetching pattern.
- SWR hooks live in `lib/swr/`: `fetcher.ts`, `useCategories.ts`, `useTrending.ts`.
- Do not use `useEffect` + manual `fetch` for new data — prefer SWR.
- Maintain error handling and loading state.
- Do not fetch from the server itself via HTTP in server-side context; call the service directly.

## localStorage and Client Persistence

- `localStorage` may only be used for genuinely local user behavior.
- Do not use it for secrets, credentials, system configuration, or state that needs to persist on the backend.
- System or admin configuration must be persisted on the server via `lib/settings.ts`.

## Tests

### Current Counts (reference — April 2026)

- **732 unit tests** (vitest, node env, `__tests__/lib/`, `__tests__/api/`, etc.)
- **63 component tests** (vitest, jsdom env, `__tests__/components/`)
- **Total: 795 tests**, all passing
- Run `npm run test:all` to get exact current count

### Vitest Configs

- `vitest.config.ts` — `node` environment, includes `**/*.test.ts` (unit tests)
- `vitest.component.config.ts` — `jsdom` environment, includes `__tests__/components/**/*.test.{ts,tsx}`

### Test Scripts

```
npm run test                → vitest run (node)
npm run test:components     → vitest run --config vitest.component.config.ts (jsdom)
npm run test:all            → test + test:components
npm run test:e2e            → playwright test
npm run test:e2e:ui         → playwright test --ui
npm run test:coverage       → vitest run --coverage
```

### Rules

- New changes to backend, auth, access, usage, Hotmart, admin, and cron must come with tests.
- New unit tests: `__tests__/` mirroring the structure of `lib/` or `app/api/`, use `prismaMock`.
- New component tests: `__tests__/components/`, import setup via `vitest.component.config.ts`.
- Do not create decorative tests; test real rules.
- If changing a critical business rule, update or create a test before refactoring.

### RTL Setup (`__tests__/components/setup.tsx`)

Already configures: jest-dom matchers, mocks for `matchMedia`, `ResizeObserver`, `IntersectionObserver`,
`next/navigation`, `next/link`, `next/image` (with `priority → loading`), `next-auth/react`.

### E2E (Playwright)

- Specs in `e2e/`: `smoke.spec.ts` (public routes + auth redirect), `login.spec.ts` (form interaction).
- Config in `playwright.config.ts`: uses `webServer` to start `next dev` automatically with dummy env vars.
- Installed browsers: Chromium. CI uses `workers: 1` and `retries: 2`.

## CI — GitHub Actions

Workflows in `.github/workflows/`:

### ci.yml — runs on push/PR to `develop` and `main`

Jobs in dependency order:

1. **typecheck** — `npx tsc --noEmit` + `prisma generate`
2. **unit-tests** — `npm run test` + `npm run test:components`
3. **build** — `npm run build`
4. **e2e-smoke** — `playwright test --project=chromium` (depends on build)

Playwright failure artifacts are uploaded to `e2e/.artifacts/` (retention: 7 days).

### auto-deploy.yml — runs on push to `develop`

Waits for `ci.yml` to pass on the same SHA, then fast-forwards `main` to `develop`.
No PR, no merge commits, no rebased SHAs — `main` and `develop` point to the exact same commit.
If fast-forward is not possible (diverged histories), fails with instructions to rebase locally.

## Deployment — Vercel

- Both `develop` and `main` branches deploy automatically on Vercel.
  - `develop` → Preview environment
  - `main` → Production environment
- Each environment has its own Neon PostgreSQL database (configured via `DATABASE_URL` and `DATABASE_URL_UNPOOLED` env vars in Vercel).
- The Vercel build command (`vercel.json`) is:
  ```
  npx prisma generate && npx prisma migrate deploy && next build
  ```
- `prisma migrate deploy` runs automatically on every deploy — it applies pending migrations safely. It **never** creates new migrations, modifies schema, or drops data.
- If there are no pending migrations, the command is a no-op.

## Database & Migration Workflow

### Priority: Vercel environments first

- **Preview** and **Production** are the primary migration targets.
- Local DB is secondary — supported but not the required path for schema evolution.
- Do not rely on "run locally first" as the mandatory workflow.

### Non-destructive migration principle

**Migrations must never delete, drop, or truncate data unless explicitly requested by the user.**
The default approach is always additive — add columns, add tables, add indexes.

- **Adding a column**: always provide a `DEFAULT` value so existing rows are not affected.
- **Renaming a column**: create the new column, copy data, then drop the old column in a **separate, later migration** only after confirming the new column works.
- **Removing a column**: do NOT drop it immediately. First remove all code references, deploy, confirm nothing breaks, then create a separate migration to drop the column.
- **Changing a column type**: add a new column with the new type, migrate data, update code to use the new column, then drop the old column in a later migration.
- **Removing a table**: same as column removal — remove all references first, deploy, confirm, then drop.
- **Removing an enum value**: never remove enum values that might still exist in rows. Migrate the data first.

### Migration safety checklist (before committing)

1. **Read the generated SQL** in `migration.sql` — never commit without reviewing.
2. Confirm the SQL does NOT contain `DROP COLUMN`, `DROP TABLE`, `DELETE`, or `TRUNCATE` unless explicitly intended.
3. Confirm every `ADD COLUMN` has a `DEFAULT` or is nullable.
4. Run `prisma migrate deploy` locally (or `prisma migrate status`) to verify the migration applies cleanly.
5. If the migration was generated with `--create-only`, verify the SQL file is NOT empty before committing.

### How schema changes work

1. Edit `prisma/schema.prisma` with the desired change.
2. Generate a migration file: `npx prisma migrate dev --name <description> --create-only`.
   - Always use `--create-only` to generate the SQL without auto-applying.
   - This creates a new SQL file in `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. **Review the generated SQL** — verify it is non-destructive and complete.
4. Apply locally: `npx prisma migrate dev` (applies the pending migration).
5. Commit the migration SQL file alongside the schema change.
6. On the next Vercel deploy, `prisma migrate deploy` applies the new migration automatically.

### Commands

| Script                | Command                 | Purpose                                      |
| --------------------- | ----------------------- | -------------------------------------------- |
| `npm run db:migrate`  | `prisma migrate dev`    | Create + apply migration (development)       |
| `npm run db:deploy`   | `prisma migrate deploy` | Apply pending migrations (safe, deploy-time) |
| `npm run db:status`   | `prisma migrate status` | Check migration status vs DB                 |
| `npm run db:generate` | `prisma generate`       | Regenerate Prisma client                     |

### Safety rules

- **Never use `prisma db push` in production** — it bypasses migration history and can lose data.
- **Never use `prisma migrate reset`** on Preview or Production.
- **Never run `--create-only` twice** for the same migration — the second run creates an empty file that overwrites the SQL.
- `prisma migrate deploy` is the only safe deploy-time command — it only applies pending SQL files.
- If a migration needs destructive changes (drop column, drop table), review the SQL manually before committing.
- If `prisma migrate deploy` fails on Vercel, the build fails and the deploy is blocked — this is correct and safe.
- The `directUrl` (unpooled connection) in `schema.prisma` is used by Prisma CLI for migrations automatically.

### Neon backup and recovery

- Neon provides **Point-in-Time Recovery (PITR)**: restore to any second within the retention window (7 days free, 30 days paid).
- In the Neon Console: Project → Branches → select branch → **Restore**.
- You can also **branch from a past timestamp** to inspect or copy data without affecting production.
- After a data loss incident, check PITR first before attempting manual reconstruction.

## Security

- Do not rely on frontend-only checks.
- All relevant authorization must exist on the server.
- Do not expose secrets in client code.
- Validate inputs and payloads on sensitive routes.
- In cron and integrations, fail safely and log enough for diagnosis.
- In webhooks, preserve current behavior to avoid undue redelivery.
- **Secret comparison**: always use `timingSafeEqual` from the native `crypto` module — never `===` or `!==` directly.
- **Fail closed**: services that depend on a configured secret must reject the operation when the secret is absent, not accept permissively.
- **No hints in errors**: error messages must not reveal any part of the secret (not prefix, not length, not hash).
- **CORS headers**: do not add `Access-Control-Allow-Origin: *` on authenticated routes — session-based authentication is already incompatible with wildcards.

## Organization Rules

- Do not let files grow without control.
- Do not introduce functional duplication.
- Do not create cosmetic directories, helpers, or services.
- Changes must be incremental and safe.
- If you find dead code, only remove it after validating the impact.

## Anti-Patterns That Must Not Be Repeated

- Do not create inline design token objects like `UI = { ... }`.
- Do not create new divergent themes.
- Do not hardcode hex colors (`#FF2D78`, `#2DD4FF`, etc.) in `sx` props when the color is already defined in the theme palette — use `"secondary.main"`, `"primary.main"`, etc. instead.
- Do not create monolithic components with 500+ lines.
- Do not duplicate quota logic.
- Do not fetch from the server itself via HTTP in server-side context.
- Do not leave important configuration only in `localStorage`.
- Do not grow already-monolithic files without extracting responsibility first.
- Do not use the `ECHOTIK_REGIONS` env var — regions come from the database.
- Do not use `console.log` — use `createLogger`.
- Do not call `new PrismaClient()` outside of `lib/prisma.ts`.
- Do not use `useEffect` + manual `fetch` for new client-side data — use SWR.
- Do not use relative paths (`../../../../lib/...`) in route handlers — use the `@/` alias.
- Do not compare secrets with `===` or `!==` — use `timingSafeEqual` from the `crypto` module.
- Do not create an API route without an internal auth guard (`requireAuth` or `requireAdmin`).
- Do not treat a missing secret as permissive mode — fail closed.
- Do not add `Access-Control-Allow-Origin: *` on authenticated routes.
- Do not use `prisma db push` on Preview or Production — use real migrations.
- Do not skip committing migration SQL files — the deploy depends on them.
- Do not run `prisma migrate dev --create-only` twice for the same migration — it overwrites the SQL with an empty file.
- Do not commit a migration without reading the generated SQL — verify it is non-empty and non-destructive.
- Do not improvise migration workflow — follow the documented process.
- Do not use any brand name other than **Hyppe** or **Hyppado** — never invent feature brand names or adopt external terminology.
- Do not commit or push code without running `npx tsc --noEmit`, `npm run build`, and `npm run test:all` first — all three must pass with zero errors.
- Do not guess TypeScript property names in test fixtures — always read the actual interface/type definition before writing fixture data.
- Do not remove the `VERCEL` env guard from cron routes — cron jobs must never run in local environments.
- Do not call `echotikRequest` (the Echotik HTTP client) from user-facing API routes to serve data — all Echotik data must come from the database, pre-ingested by the cron. The only allowed exceptions are: cron ingestion modules, image upload cron, download URL caching cron, image proxy (deprecated fallback), and transcription (fallback when cached download URL is unavailable).

## Maintenance Priorities When Working on the Project

1. security
2. functional compatibility
3. access and quota rules
4. Hotmart/Echotik/cron integrity
5. tests
6. organization and componentization
7. cosmetic improvements

## Mandatory Validation Before Marking a Task as Done

- Run `npx tsc --noEmit` and confirm zero type errors.
- Run `npm run build` and confirm exit code 0.
- Run `npm run test:all` and confirm that all tests pass (currently 795).
- If the typecheck, build, or tests break, fix before committing.
- **Never commit or push code with type errors, lint errors, test failures, or build failures — no exceptions.**
- When creating or modifying test files, verify that fixture data matches the actual TypeScript interfaces. Do not guess property names — read the type definition first.
- This applies to any change: refactoring, file removal, new feature, fix, test addition.

## How to Respond to Changes in This Project

When implementing something:

1. understand how the area already works
2. identify the impact
3. apply the minimum safe change
4. suggest larger refactoring only if necessary

When writing code:

- prefer simple solutions
- preserve existing conventions
- do not reinvent an already-consolidated flow
- avoid excessive abstraction

## When to Refactor

Refactor when there is real duplication, bug risk, excessive coupling,
a file that is too large, low testability, or a rule duplicated in more than one place.

Do not refactor purely for aesthetics if it increases risk without real gain.

- Nothing in this project is public. There are no public API routes.
- Every route in `app/api/**` must require server-side authentication (session via NextAuth).
- The mandatory pattern is `requireAuth()` / `isAuthed()` from `lib/auth.ts`.
- Admin routes must use `requireAdmin()` — never just a frontend role check.
- Do not create anonymous API routes. Not even "temporarily".
- Do not rely on frontend checks for protected operations.
- Do not rely on middleware alone — every route must have an internal auth guard.
- The only valid exceptions are: webhooks (auth by HMAC/signature) and cron routes (auth by CRON_SECRET).
- Webhooks must validate payload origin with a strong mechanism — use `timingSafeEqual` for token comparison, never `===`.
- Webhook validation must be fail closed: missing secret = reject, not accept.
- Any new public-facing endpoint requires a formal, documented decision before creation.
