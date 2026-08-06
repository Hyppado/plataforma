# API Documentation

> **Last updated**: 2026-08-06 (refresh — adds Shopee endpoints and data models)

## REST API Surface

All routes are Next.js App Router API routes (`route.ts`) — **93 handlers** in total. Auth is enforced via `requireAuth()` / `requireAdmin()` helpers from `lib/auth.ts` unless noted as public.

---

## Authentication

### POST /api/auth/[...nextauth]
- **Purpose**: NextAuth.js catch-all handler (login, session, signout)
- **Auth**: Public
- **Provider**: Credentials (email + password)

### POST /api/auth/setup-password
- **Purpose**: First-time password setup via token (onboarding link)
- **Auth**: Public (validated via setup token)

### POST /api/auth/reset-password
- **Purpose**: Password reset flow
- **Auth**: Public (validated via setup token)

---

## User Profile (`/api/me`)

### GET /api/me/alerts
- **Purpose**: Fetch user alerts (new products, trends, creator rises)
- **Auth**: Authenticated user

### GET/POST /api/me/collections
- **Purpose**: List and create user collections
- **Auth**: Authenticated user

### GET/POST /api/me/notes
- **Purpose**: List and create notes on videos/products
- **Auth**: Authenticated user

### POST /api/me/password
- **Purpose**: Change own password
- **Auth**: Authenticated user

### GET/POST/DELETE /api/me/saved
- **Purpose**: Manage saved items (videos, products)
- **Auth**: Authenticated user

---

## Trending Data

### GET /api/trending/videos
- **Purpose**: Fetch ranked trending TikTok videos
- **Auth**: Authenticated user
- **Query params**: country, category, rankingCycle, rankField, page, limit

### GET /api/trending/products
- **Purpose**: Fetch ranked trending TikTok products
- **Auth**: Authenticated user
- **Query params**: country, category, rankingCycle, rankField, page, limit

### GET /api/trending/new-products
- **Purpose**: Fetch newly discovered products
- **Auth**: Authenticated user

### GET /api/trending/creators
- **Purpose**: Fetch ranked trending TikTok creators
- **Auth**: Authenticated user

### GET /api/trending/products/[id]
- **Purpose**: Fetch single product details
- **Auth**: Authenticated user

### GET /api/echotik/videos/trending
- **Purpose**: Direct EchoTik video trending endpoint
- **Auth**: Authenticated user

### GET /api/echotik/categories
- **Purpose**: Fetch product categories list
- **Auth**: Authenticated user

### GET /api/regions
- **Purpose**: Fetch active regions/countries
- **Auth**: Authenticated user

### GET /api/exchange-rate
- **Purpose**: Fetch current USD/BRL exchange rate
- **Auth**: Authenticated user

---

## Transcripts & Insights

### GET/POST /api/transcripts
- **Purpose**: List or create transcript requests
- **Auth**: Authenticated user

### GET /api/transcripts/[videoExternalId]
- **Purpose**: Get transcript for a specific video
- **Auth**: Authenticated user

### GET/POST /api/insights
- **Purpose**: List or create AI insights
- **Auth**: Authenticated user

### GET /api/insights/[videoExternalId]
- **Purpose**: Get insight for a specific video (for current user)
- **Auth**: Authenticated user

---

## Usage

### GET /api/usage
- **Purpose**: Get current user's usage for the current period
- **Auth**: Authenticated user

### POST /api/usage/consume
- **Purpose**: Record a usage event (internal — called by AI features)
- **Auth**: Authenticated user

---

## Influencer IA

### POST /api/influencer-ia/generate
- **Purpose**: Generate influencer-style AI content (hook, copy, CTA)
- **Auth**: Authenticated user
- **Extended timeout**: 120s

### GET/POST /api/influencer-ia/draft
- **Purpose**: Persist cross-device wizard draft state
- **Auth**: Authenticated user

### POST /api/influencer-ia/prepare-product-image
- **Purpose**: Download and proxy a product image for editing
- **Auth**: Authenticated user

### POST /api/influencer-ia/upload-reference
- **Purpose**: Upload a user-provided reference image to Vercel Blob
- **Auth**: Authenticated user

### GET /api/influencer-ia/product-images
- **Purpose**: List product images for use in wizard
- **Auth**: Authenticated user

### POST /api/influencer-ia/generate-veo-prompt
- **Purpose**: Generate a VEO 3 video prompt from concept
- **Auth**: Authenticated user

### GET /api/influencer-ia/usage
- **Purpose**: Get daily Influencer IA usage for current user
- **Auth**: Authenticated user

### GET/POST /api/influencer-ia/avatar-uploads
- **Purpose**: List or upload avatar reference images
- **Auth**: Authenticated user

### DELETE /api/influencer-ia/avatar-uploads/[id]
- **Purpose**: Delete an uploaded avatar image
- **Auth**: Authenticated user

---

## Avatar Video

### GET /api/avatar-video/avatars
- **Purpose**: List available avatar profiles (admin-managed)
- **Auth**: Authenticated user

---

## Plans

### GET /api/plans
- **Purpose**: List active subscription plans for display
- **Auth**: Public

---

## User Account

### GET /api/user/access
- **Purpose**: Check current user's access status and active plan
- **Auth**: Authenticated user

### POST /api/user/consent
- **Purpose**: Record LGPD consent (terms, privacy policy)
- **Auth**: Authenticated user

### POST /api/user/erasure
- **Purpose**: Submit a data erasure request
- **Auth**: Authenticated user

---

## Shopee *(added 2026-07/08)*

### GET /api/shopee/ranking
- **Purpose**: Return the full Shopee best-seller ranking snapshot
- **Auth**: Authenticated user
- **Query params**: none — returns every `ShopeeProductTrend` row ordered by `rankPosition` ascending
- **Response**: `{ ok: true, products: ShopeeProductTrend[] }`
- **Note**: Unpaginated. The row count is bounded by `SHOPEE_RANKING_LIMIT` (default 50), so the payload is small today, but the endpoint does not enforce a limit itself.

### GET /api/shopee/achadinhos
- **Purpose**: Paginated feed of achadinhos (TikTok videos matched to Shopee products)
- **Auth**: Authenticated user
- **Query params**:
  - `page` — default `1`
  - `pageSize` — default `24`, clamped to `1..100`
  - `sort` — one of `createdAt | price | saleCount | productName | updatedAt`; default `saleCount` (allow-listed to prevent injection)
  - `order` — `asc | desc`, default `desc`
  - `category` — exact category match
  - `search` — case-insensitive `contains` on `productName`
  - `status` — pass `all` to include `FAILED` records; otherwise `FAILED` is excluded
- **Response**: `{ ok, achadinhos[], total, page, pageSize, hasMore, categorias[] }`
- **Note**: `views` is a `BigInt` column and is coerced to `Number` by `serializeAchadinho()` before serialization.

### PATCH /api/shopee/achadinhos/[id]
- **Purpose**: Override the affiliate link of a single achadinho
- **Auth**: Authenticated user **with ADMIN role** (checked in-handler — this path is outside the `/api/admin/*` middleware matcher)
- **Request**: `{ affiliateLink: string }` — must parse as an `http:`/`https:` URL
- **Behavior**: On first override, the current link is copied into `originalAffLink` so the machine-generated value is preserved
- **Response**: `{ ok: true, achadinho }` — `400` invalid URL, `403` non-admin, `404` unknown id

---

## Webhooks

### POST /api/webhooks/hotmart
- **Purpose**: Receive Hotmart subscription events
- **Auth**: HMAC signature verification (`HOTMART_WEBHOOK_SECRET`)
- **Events handled**: PURCHASE_APPROVED, SUBSCRIPTION_CANCELLATION, PURCHASE_REFUNDED, etc.

---

## Prompt Library

### GET /api/prompt-library
- **Purpose**: Fetch curated prompt library items
- **Auth**: Authenticated user

---

## Public

### POST /api/public/support-email
- **Purpose**: Submit a support request (no login required from landing page)
- **Auth**: Public

### POST /api/support-email
- **Purpose**: Submit a support request (from within app)
- **Auth**: Authenticated user

---

## Cron Jobs (internal)

All cron handlers are **GET**. Each one refuses to run when `process.env.VERCEL` is unset (local execution blocked, `403`) and validates `Authorization: Bearer <CRON_SECRET>` using `timingSafeEqual`. A missing `CRON_SECRET` returns `500` — fail-closed, never fail-open.

### GET /api/cron/echotik
- **Purpose**: Ingest trending data from EchoTik API
- **Schedule**: Every 15 minutes (`*/15 * * * *`)

### GET /api/cron/sync-db
- **Purpose**: Database sync/cleanup tasks
- **Schedule**: Daily at 6am (`0 6 * * *`)

### GET /api/cron/exchange-rate
- **Purpose**: Update USD/BRL exchange rate
- **Schedule**: Weekdays at 4:30pm (`30 16 * * 1-5`)

### GET /api/cron/transcribe
- **Purpose**: Process pending video transcription jobs
- **Schedule**: Not registered in `vercel.json` — invoked on demand

### GET /api/cron/shopee *(new)*
- **Purpose**: Shopee ranking sync and/or the achadinhos AI ingestion pipeline
- **Schedule**: Two entries in `vercel.json`, both `0 */6 * * *` — `?task=ranking` and `?task=achadinhos`
- **Query params**:
  - `task` — `ranking | achadinhos | all` (default `all`)
  - `force` — `true` bypasses the frequency gate
  - `count` — achadinhos batch size, clamped to `20..400`; overrides the admin Setting
- **Effective cadence**: the 6-hour schedule only *offers* a run. `shouldSkipShopeeTask()` skips it unless the last `SUCCESS` `IngestionRun` for `shopee:ranking` / `shopee:achadinhos` is older than the configured window (defaults: 24h ranking, 12h achadinhos).
- **Timeout**: `maxDuration = 300` declared in the route module
- **Response**: `{ ok, task, count, results: { rankings?, achadinhos? } }` — a task returns `-1` when skipped by the frequency gate

---

## Admin API (`/api/admin/*` — ADMIN role required)

### GET/POST /api/admin/users
- **Purpose**: List and create users

### GET/PUT/DELETE /api/admin/users/[id]
- **Purpose**: Manage individual user

### GET/POST /api/admin/access-grants
- **Purpose**: Manage manual access grants

### GET /api/admin/subscribers
- **Purpose**: List subscribers with plan/status details

### GET /api/admin/subscription-metrics
- **Purpose**: Aggregate subscription metrics for financial dashboard

### GET/PUT /api/admin/plans
- **Purpose**: List and update subscription plans

### GET/POST /api/admin/notifications
- **Purpose**: Admin notification inbox management

### GET/PUT /api/admin/notifications/summary
- **Purpose**: Notification summary counts

### PUT /api/admin/notifications/[id]
- **Purpose**: Mark notification as read/archived/resolved

### GET /api/admin/webhook-events
- **Purpose**: List Hotmart webhook events with processing status

### GET/POST /api/admin/settings
- **Purpose**: Read and update dynamic settings

### GET/PUT /api/admin/settings/google-ai
- **Purpose**: Google AI API key management

### GET/PUT /api/admin/settings/openai
- **Purpose**: OpenAI API key management

### GET/PUT /api/admin/settings/support
- **Purpose**: Support email configuration

### GET/POST /api/admin/settings/shopee *(new)*
- **Purpose**: Shopee Affiliate credentials and sync tuning
- **GET response**: `{ configured, rankingLimit, rankingFrequency, achadinhosFrequency, achadinhosCount, achadinhosHashtagId }` — `configured` is true only when both credentials exist; **secret values are never returned**
- **POST body** (all optional, only provided fields are written):
  - `affiliateAppId`, `affiliateSecret` — stored via `upsertSecretSetting()` (AES-256-GCM encrypted at rest)
  - `rankingLimit`, `rankingFrequency`, `achadinhosFrequency`, `achadinhosHashtagId` — plain settings
  - `achadinhosCount` — parsed and clamped to `20..400` before persisting

### POST /api/admin/settings/openai/test
- **Purpose**: Validate the stored OpenAI credential

### GET /api/admin/audit-logs
- **Purpose**: View system audit logs

### GET /api/admin/usage
- **Purpose**: View per-user usage reports

### GET /api/admin/quota-usage
- **Purpose**: View quota utilization metrics

### GET/PUT /api/admin/quota-policy
- **Purpose**: Configure quota policies

### GET/PUT /api/admin/hotmart/credentials
- **Purpose**: Manage Hotmart API credentials

### GET /api/admin/hotmart/plans
- **Purpose**: Sync Hotmart plan catalog

### GET/POST /api/admin/echotik/config
- **Purpose**: EchoTik configuration

### GET /api/admin/echotik/health
- **Purpose**: EchoTik integration health check

### GET /api/admin/echotik/regions
- **Purpose**: Manage available regions

### GET /api/admin/echotik/runs
- **Purpose**: View ingestion run history

### GET /api/admin/cost-estimate
- **Purpose**: AI API cost estimation

### GET/POST /api/admin/prompt-config
- **Purpose**: AI prompt configuration management

### GET/POST/PUT/DELETE /api/admin/prompt-library
- **Purpose**: Curate prompt library

### POST /api/admin/prompt-library/upload
- **Purpose**: Upload prompt library item with image

### GET/PUT /api/admin/privacy-policy
- **Purpose**: Manage privacy policy content

### GET/PUT /api/admin/terms-of-use
- **Purpose**: Manage terms of use content

### GET /api/admin/erasure-requests
- **Purpose**: List and process LGPD erasure requests

### GET/POST /api/admin/avatar-video/avatars
- **Purpose**: Manage avatar profiles

### GET/POST /api/admin/avatar-video/scenarios
- **Purpose**: Manage video scenarios

---

## Data Models

**Total**: 42 Prisma models (`prisma/schema.prisma`), 33 migrations. The models below are the ones that shape the API contracts.

### User
- **Fields**: id, email, name, passwordHash, mustChangePassword, role (ADMIN/USER), status (ACTIVE/INACTIVE/SUSPENDED), lgpdConsent, deletedAt (soft delete)
- **Relationships**: subscriptions, usagePeriods, savedItems, collections, notes, alerts, accessGrants, videoInsights, avatarVideoCreations

### Plan
- **Fields**: id, code, name, priceAmount, periodicity (MONTHLY/ANNUAL), isActive, features (JSON), quotas (transcriptsPerMonth, scriptsPerMonth, insightTokensMonthlyMax, etc.), hotmartPlanCode, hotmartNumericPlanId
- **Relationships**: subscriptions, accessGrants

### Subscription
- **Fields**: id, userId, planId, status (PENDING/ACTIVE/PAST_DUE/CANCELLED/EXPIRED), source (hotmart/manual/invite), dates
- **Relationships**: user, plan, hotmart (HotmartSubscription), charges

### EchotikVideoTrendDaily
- **Fields**: videoExternalId, date, country, rankPosition, views, likes, sales, gmv, title, authorName, category, downloadUrl
- **Relationships**: (standalone snapshot — no FK to users)

### VideoTranscript
- **Fields**: videoExternalId (unique), status (PENDING/PROCESSING/READY/FAILED), transcriptText, segmentsJson, language
- **Relationships**: (shared across users — no userId)

### VideoInsight
- **Fields**: userId, videoExternalId, status, contextText, hookText, problemText, solutionText, ctaText, copyWorkedText, tokensUsed
- **Relationships**: user (private per user)

### UsagePeriod / UsageEvent
- **Fields**: userId, periodStart, periodEnd, transcriptsUsed, scriptsUsed, insightsUsed, tokensUsed, avatarVideosUsed
- **Relationships**: user, events (UsageEvent with idempotencyKey)

### AccessGrant
- **Fields**: userId, grantedBy, reason, planId, startsAt, expiresAt, isActive
- **Relationships**: user, plan

### ShopeeProductTrend *(new)*
- **Fields**: id, date (`@db.Date`), rankPosition, productExternalId (`@unique`), productName, coverUrl, price, commissionRate, saleCount, gmv, rating, shopName, affiliateLink, categoryName, subCategoryName, categoryId, subCategoryId, syncedAt, createdAt
- **Indexes**: `categoryId`, `subCategoryId`, `categoryName`
- **Relationships**: none — standalone snapshot, no FK to users
- **Validation / invariants**: the whole table is deleted and rebuilt on each successful ranking sync; `rankPosition` is assigned 1..N by descending `saleCount`. `categoryId`/`subCategoryId` come from `productCatIds[0]`/`[1]` and are mapped to names by `lib/shopee/shopee-categories.ts`.

### ShopeeAchadinhoProduct *(new)*
- **Fields**: id, videoExternalId (`@unique`), videoUrl (canonical TikTok URL), videoTitle, coverUrl, transcriptText, productName, category, affiliateLink, originalAffLink, price, saleCount, commission, views (`BigInt`), authorName, status, errorMessage, productImageUrl, productPriceMin, productPriceMax, productLink, createdAt, updatedAt
- **Indexes**: `[status, createdAt]`, `category`
- **Relationships**: none — shared catalog, not per-user
- **Status** is a plain `String`, not a Prisma enum: `PENDING` (awaiting admin review — the pipeline's success terminal state), `PROCESSING`, `READY`, `FAILED`
- **Validation / invariants**:
  - Only videos with **≥ 30,000 views** enter the pipeline
  - A Shopee match requires **sales > 0 and price > 0**
  - `videoUrl` is always the canonical `https://www.tiktok.com/@{handle}/video/{id}` form, built from `authorName` (falling back to `@user`)
  - `originalAffLink` retains the machine-generated link once an admin overrides `affiliateLink`
  - `views` is `BigInt` in the DB and coerced to `Number` at the API boundary
