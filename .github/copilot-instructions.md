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
    cards/         → video, product, creator, rank cards
    dashboard/     → authenticated dashboard components
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
  echotik/
    client.ts      → HTTP client for Echotik API
    admin/         → admin-facing echotik services
      estimation.ts
      health.ts
    cron/          → ingestion cron modules
      orchestrator.ts  → detectNextTask() → {task, region} | null
      helpers.ts       → getConfiguredRegions(), cleanupStaleRuns(), hasExcessiveFailures()
      syncVideos.ts    → syncVideoRanklist(runId, region, log)
      syncProducts.ts  → syncProductRanklist(runId, region, log)
      syncCreators.ts  → syncCreatorRanklist(runId, region, log)
      syncCategories.ts
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
    saved.ts
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
    cron/
      echotik.test.ts
      transcribe.test.ts
    me/
      alerts.test.ts
      collections.test.ts
      notes.test.ts
      saved.test.ts
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

- **User** — central identity; has role, status, LGPD fields, soft delete (`deletedAt`)
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
- **NextAuth handler** (`/api/auth/[...nextauth]`) — managed internally by NextAuth.

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

- **HTTP Client**: `lib/echotik/client.ts`
- **Orchestrator**: `lib/echotik/cron/orchestrator.ts`
  - `detectNextTask(force?)` → `{ task, region } | null`
  - Iterates: categories → videos per region → products per region → creators per region → details
  - Skip keys in the format `echotik:videos:BR`, `echotik:products:US`, etc.
- **Sync functions**: each receives `(runId, region, log)` — one region per invocation
  - `syncVideoRanklist(runId, region, log)` in `syncVideos.ts`
  - `syncProductRanklist(runId, region, log)` in `syncProducts.ts`
  - `syncCreatorRanklist(runId, region, log)` in `syncCreators.ts`
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
- **Renewal**: `recurrenceNumber > 1` = renewal (no admin notification, audit action = `WEBHOOK_PURCHASE_RENEWED`)
- **Idempotency**: webhook dedup by `idempotencyKey` (UNIQUE), subscription upsert by external ID, charge upsert by transactionId, notification dedup by dedupeKey
- **User identity rule**: Hotmart is an external commercial source, NOT the primary user identity. `ExternalAccountLink` is optional/external, not identity-defining.
- Do not create new provisioning paths outside this handler for Hotmart.

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

- **617 unit tests** (vitest, node env, `__tests__/lib/`, `__tests__/api/`, etc.)
- **63 component tests** (vitest, jsdom env, `__tests__/components/`)
- **Total: 680 tests**, all passing
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

### How schema changes work

1. Edit `prisma/schema.prisma` with the desired change.
2. Generate a migration file: `npm run db:migrate` (runs `prisma migrate dev`).
   - This requires some DB to diff against. Use local or any dev DB.
   - This creates a new SQL file in `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Commit the migration SQL file alongside the schema change.
4. On the next Vercel deploy, `prisma migrate deploy` applies the new migration automatically.

### Commands

| Script                | Command                 | Purpose                                      |
| --------------------- | ----------------------- | -------------------------------------------- |
| `npm run db:migrate`  | `prisma migrate dev`    | Create new migration (development)           |
| `npm run db:deploy`   | `prisma migrate deploy` | Apply pending migrations (safe, deploy-time) |
| `npm run db:status`   | `prisma migrate status` | Check migration status vs DB                 |
| `npm run db:generate` | `prisma generate`       | Regenerate Prisma client                     |

### Safety rules

- **Never use `prisma db push` in production** — it bypasses migration history and can lose data.
- **Never use `prisma migrate reset`** on Preview or Production.
- `prisma migrate deploy` is the only safe deploy-time command — it only applies pending SQL files.
- If a migration needs destructive changes (drop column, drop table), review the SQL manually before committing.
- If `prisma migrate deploy` fails on Vercel, the build fails and the deploy is blocked — this is correct and safe.
- The `directUrl` (unpooled connection) in `schema.prisma` is used by Prisma CLI for migrations automatically.

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
- Do not improvise migration workflow — follow the documented process.
- Do not use any brand name other than **Hyppe** or **Hyppado** — never invent feature brand names or adopt external terminology.
- Do not commit or push code without running `npx tsc --noEmit`, `npm run build`, and `npm run test:all` first — all three must pass with zero errors.
- Do not guess TypeScript property names in test fixtures — always read the actual interface/type definition before writing fixture data.

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
- Run `npm run test:all` and confirm that all tests pass (currently 680+).
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
