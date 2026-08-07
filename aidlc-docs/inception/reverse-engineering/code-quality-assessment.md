# Code Quality Assessment

> **Last updated**: 2026-08-06 (refresh, then updated after remediation)
>
> **Remediation status**: items 1–7 below were worked through in a single session on 2026-08-06.
> Resolved: `category` never written; missing approval gate; dead exports; non-transactional
> ranking rebuild; `status` → Prisma enum; GraphQL escaping + failure surfacing; Shopee test
> coverage (0 → 96 tests). Vercel function-timeout hardening was done alongside them.
> A deferred decision (splitting the achadinhos cron into producer + worker) is recorded in
> `aidlc-docs/audit.md`.

## Test Coverage

- **Overall**: Good for the original TikTok/billing surface; **absent for the new Shopee vertical**
- **Unit Tests (Vitest — node env)**: 78 files covering API routes and lib modules (auth, crypto, hotmart, echotik, insight, transcription, usage, lgpd, access, admin, logger)
- **Component Tests (Vitest — jsdom env)**: 8 files (VideoCard skeleton, CategoryFilter, LoginPage, Logo, RankBadge, TimeRangeSelect, admin components)
- **Security Tests**: `__tests__/security.test.ts` — HTTP security headers, auth enforcement
- **Middleware Tests**: `__tests__/middleware.test.ts` — edge middleware behavior
- **E2E Tests (Playwright)**: `e2e/login.spec.ts`, `e2e/smoke.spec.ts` — run against `next dev` in CI
- **Shopee**: **zero test files reference Shopee** (`grep -ril shopee __tests__ e2e` returns nothing). ~5,000 lines of new code — including an eight-hop external pipeline, a money-touching affiliate-link path, and an admin-only PATCH endpoint — ship untested.

## Code Quality Indicators

- **TypeScript**: Strict — all code is TypeScript; typed API routes, typed DB access via Prisma
- **Linting**: Not explicitly configured (no `.eslintrc` or `eslint.config.js`) — Next.js default linting only
- **Code Style**: Consistent throughout; clear module boundaries, descriptive naming
- **Documentation**: Very good — the Shopee module in particular carries extensive header comments explaining *why* each guardrail exists (Risk Control pagination, fast-fail, strict merge). This is above the codebase average.
- **Language mixing**: Comments and log messages in the Shopee module are Portuguese; the rest of the codebase mixes Portuguese and English. Not a defect, but worth an explicit convention.
- **Path Aliases**: `@/` alias configured (`tsconfig.json`) and used consistently

## Technical Debt

### Pre-existing
- **No dedicated linting config**: ESLint is available via Next.js but no custom rule set is defined.
- **API keys in the `Setting` table rather than env vars**: A deliberate choice (runtime-reconfigurable, encrypted at rest), but it means AI and Shopee features fail silently if the DB is unreachable.
- **`EchotikRawResponse` growth**: Stores full API payloads for reproducibility with no TTL or cleanup strategy.
- **Influencer IA quota**: `influencerIaDailyQuota` is a daily limit in a model that otherwise tracks monthly usage.
- **Repo-root clutter**: `Untitled-1.yml`, `clean-plans.js`, and a committed `out/` directory sit at the workspace root.
- **`lib/useViewMode.ts`**: A hook in `lib/` rather than a `hooks/` directory.

### Introduced with the Shopee vertical
- **`ShopeeAchadinhoProduct.category` is never written.** The pipeline never sets it; `saveProductResult()` and `upsertProcessingRecord()` both omit the field. Consequence: `GET /api/shopee/achadinhos` always returns `categorias: []`, and the `?category=` filter and the UI category dropdown are inert. The DB index on `category` is unused.
- **The documented admin-approval gate does not exist.** Comments and the `READY` status describe a review step ("status PENDING — admin aprova"), but no code transitions an achadinho out of `PENDING`, and the user-facing feed excludes only `FAILED`. In practice unreviewed records are served to end users immediately. Either implement the approval transition or drop the claim from the code comments.
- **Dead code**: `processAchadinhoVideoFast()` (`lib/shopee/pipeline.ts:554`) and `buscarVideosAchadinhosShopee()` (`lib/shopee/client.ts:297`) are exported but never called. `processAchadinhoVideoFast` duplicates ~80 lines of `saveAchadinhoFromPipelineItem`, so the two will drift.
- **Unused setting key**: `SETTING_KEYS.SHOPEE_ACHADINHOS_KEYWORD` and `SHOPEE_DEFAULTS.ACHADINHOS_KEYWORD` are defined but never read — the "dynamic hashtag discovery" they were meant to support is not implemented.
- **Non-transactional full-table rebuild**: `syncShopeeRankings()` calls `deleteMany({})` and then upserts row by row outside a transaction. A failure mid-loop leaves a partially populated ranking; an empty API response deletes every row and leaves the page blank. Wrapping the swap in `prisma.$transaction` (or writing to a new snapshot and switching) would make it atomic.
- **GraphQL built by string interpolation**: `searchShopeeProductsGraphQL()` and `generateShortLink()` interpolate values into the query string and escape only `"`. Inputs are internal today (a fixed keyword list, a GPT-extracted product name, a Shopee-returned URL), so exposure is limited — but GraphQL variables would remove the class of problem entirely, and the GPT-extracted name is the one value an outside party (a TikTok caption author) can influence.
- **Silent failure in `graphqlRequest`**: Non-OK responses and thrown errors both return `{} as T`. Callers cannot distinguish "no results" from "the API is down", which makes ranking emptiness ambiguous and, combined with the point above, can wipe the ranking table.
- **Status as a bare `String`**: `ShopeeAchadinhoProduct.status` is a `String` with values enforced only by convention, unlike `TranscriptStatus` / `InsightStatus`, which are Prisma enums. A typo is a silent data bug.
- **Fixed schedule vs. configurable cadence**: `vercel.json` runs both Shopee tasks every 6 hours, but the effective cadence is gated by settings (24h / 12h defaults). The two must be reasoned about together — a setting *below* 6h cannot take effect. Worth documenting next to the admin field.
- **Shopee images are hot-linked**: Unlike TikTok assets, Shopee product images are not cached to Vercel Blob. This adds a runtime dependency on Shopee's CDN and required widening `img-src`/`connect-src` in the CSP to four wildcard host patterns.
- **Unpaginated ranking endpoint**: `GET /api/shopee/ranking` returns every `ShopeeProductTrend` row with no limit. Safe while `SHOPEE_RANKING_LIMIT` is 50, but the endpoint does not enforce that bound itself.
- **Sequential-by-design throughput**: The pipeline processes videos one at a time with ~2s inter-page delays. With `achadinhos_count` set near its 400 maximum, a run can approach the 300s function ceiling. There is no partial-progress checkpoint beyond per-record persistence — records already saved survive, but the run is marked `FAILED`.

## Patterns and Anti-patterns

**Good Patterns**:
- **Idempotency everywhere**: Webhook events, usage events, transcripts, and now both Shopee tables use unique keys and `upsert` to prevent duplicate processing.
- **Separation of identity and billing**: `User` is independent of `ExternalAccountLink` / `HotmartSubscription`, enabling manual grants and multi-provider support.
- **Access resolution layer**: `lib/access/resolver.ts` centralizes the "can this user use the app?" question with a clear priority chain.
- **Secure secret storage**: OpenAI, Google, and now Shopee credentials are AES-256-GCM encrypted at rest in the `Setting` table. The admin GET endpoint returns only a boolean `configured` flag, never the values.
- **Per-request nonce CSP**: Each request gets a unique nonce, preventing XSS via inline script injection.
- **Fail-closed cron auth**: Every cron route rejects non-Vercel execution, requires `CRON_SECRET`, returns 500 when the secret is unset, and compares with `timingSafeEqual`. The new Shopee route follows the same pattern exactly.
- **Audit log for login rate limiting**: Reuses the existing `AuditLog` table for brute-force protection.
- **Cascade delete rules**: Explicit `onDelete: Cascade` / `SetNull` rules prevent orphan records.
- **LGPD soft delete**: `User.deletedAt` enables erasure compliance without destroying the audit trail.
- **Defensive external-data parsing** *(new)*: `parseViewsFromEchoTikItem()` tries three field paths, coerces to `Number`, and returns `0` on `NaN` — external APIs are treated as untrusted shapes.
- **Layered graceful degradation** *(new)*: captions → Whisper; short link → offer link → search URL; hashtag ID from four sources. One failing hop degrades quality rather than breaking the run.
- **Per-item error isolation** *(new)*: Every video is wrapped in `try`/`catch`; a failure marks that record `FAILED` and continues. One bad video cannot abort a 400-video batch.
- **Transcript persisted before extraction** *(new)*: The pipeline writes `transcriptText` immediately after obtaining it, so an expensive Whisper call is never wasted when the downstream GPT step fails.
- **Cost-aware frequency gating** *(new)*: `IngestionRun`-based skip logic decouples schedule from cadence and gives admins a direct lever on external API spend, with a `?force=true` escape hatch.
- **Adapter reuse** *(new)*: `lib/shopee/adapters.ts` projects Shopee DTOs onto the existing `ProductDTO`/`VideoDTO` shapes, so the Shopee pages reuse TikTok cards and modals without forking them.
- **Sort-field allow-listing** *(new)*: `GET /api/shopee/achadinhos` maps `?sort=` through a `SORT_FIELDS` record instead of passing user input to Prisma `orderBy`.

**Anti-patterns / Areas for Improvement**:
- **No API versioning**: Routes have no version prefix; breaking changes affect all clients immediately.
- **Business logic in API routes**: Some handlers contain significant logic beyond calling a service function.
- **No global error boundary on API routes**: Each route handles errors individually; a shared wrapper would standardize responses.
- **Inconsistent authorization placement** *(new)*: `PATCH /api/shopee/achadinhos/[id]` is admin-only but sits outside the `/api/admin/*` middleware matcher, so the role check exists only in the handler. The rule "admin endpoints live under `/api/admin`" now has an exception, and the middleware is no longer a complete picture of who can do what.
- **SWR polling for async jobs**: Transcript and insight generation rely on client-side polling; SSE or websockets would cut API load.
- **Comment-documented behavior that the code does not implement** *(new)*: the admin-approval gate above. Comments this detailed are a strength of this codebase, which makes divergence from them costlier than usual — a reader trusts them.

## Remediation Log (2026-08-06)

| # | Item | Outcome |
|---|---|---|
| 1 | Shopee test coverage | **Done** — 165 tests across 11 files, from a starting point of zero. `app/api/cron/shopee` 100% stmts; `lib/shopee/cron` 96%; `app/api/admin/settings/shopee` 85%; `lib/shopee` 80% stmts / 92.6% funcs. Covers both security boundaries (cron `CRON_SECRET` guards, admin credential handling) and the "correção crítica" product-vs-video link separation at component level |
| 2 | Achadinho lifecycle | **Done** — full approval gate. Feed serves `READY` only; `?status=` honored for ADMIN only; `approve`/`reject`/`reset` actions; `REJECTED` added; `PROCESSING`/`FAILED` refused (409) as pipeline-owned |
| 3 | `category` never populated | **Done** — pipeline resolves from `productCatIds` with a product-name fallback. Also fixed `mapShopeeCategories()`, whose exact-match-only fallback could never match a GPT-extracted name |
| 4 | Ranking rebuild | **Done** — atomic `deleteMany`+`createMany` in one transaction; never deletes without a replacement; errors propagate so the run is `FAILED` (an outage previously recorded `SUCCESS` and froze retries for 24h); shrink guard on partial keyword failure |
| 5 | Dead code | **Done** — `processAchadinhoVideoFast` merged into the canonical `processAchadinhoVideo`; `buscarVideosAchadinhosShopee` removed with its orphaned interface and import |
| 6 | `status` → Prisma enum | **Done** — `ShopeeAchadinhoStatus` (5 values). Migration casts defensively (`ELSE 'PENDING'`) because migrations run inside the Vercel build and a failed cast would abort the deploy |
| 7 | GraphQL hardening | **Partly done** — literals now escaped via `JSON.stringify` (handles quotes, backslashes, newlines, unicode); transport/HTTP/GraphQL errors throw `ShopeeApiError` instead of returning `{}`. **Not done**: switching to GraphQL *variables*, which needs verification against the live vendor API |

### Notable discovery during remediation

Items 4 and 7 were coupled. `graphqlRequest()` swallowed every failure and returned `{}`, so `searchShopeeProductsGraphQL()` never threw, so the per-keyword `catch` in `syncShopeeRankings()` never fired, so `keywordFailures` stayed at `0` — meaning the shrink guard added in item 4 was **inert until item 7 landed**. Error-swallowing at a boundary silently disabled a protection three call levels up.

## Segunda rodada de remediação (2026-08-07)

Disparada por uma reavaliação usando os skills `next-best-practices`,
`vercel-react-best-practices` e `echotik-api-assistant`.

| Item | Resultado |
|---|---|
| **Link de afiliado** | **Mudança de produto**: o pipeline assinava os links com as credenciais da plataforma e a tag `hyppado_achadinhos` — o assinante divulgava e a comissão caía na Hyppado. Agora serve o link direto do produto (`productLink`), sem atribuição a ninguém |
| **Retry em `code != 0`** | O client só re-tentava `code === 500`; a doc (global-rules §10.3) manda re-tentar qualquer `code != 0` e diz que essas respostas não consomem cota. `isRetryableEnvelopeCode` cobre todos agora |
| **`cacheDownloadUrls.ts`** | O cron da EchoTik chamava `download-url` sem retries — mesmo defeito já corrigido no lado Shopee, vivo num segundo lugar. Corrigido |
| **Assinatura de capas em lote** | `batch/cover/download` aceita 10 URLs e não consome cota, mas assinávamos 1 por vez (~10x mais chamadas — e volume é o que dispara risk control). `signEchotikCoverUrls` agora agrupa de 10 em 10; `uploadImages` percorre em blocos |
| **Imagens Shopee** | Alinhadas ao padrão do projeto (`Box component="img"` + `loading="lazy"` + `onError`), como em `VideoCard`. O `<img>` cru com `eslint-disable` foi removido. `loading="lazy"` acrescentado em 4 componentes que não tinham |
| **Memoização** | `filtered`/`ordered`/`paginated` do `ShopeeAdminTab` eram recalculados a cada render (inclusive ao abrir o player). Agora em `useMemo`; `REVIEW_PRIORITY` foi para o escopo do módulo |
| **Hooks SWR** | `ShopeeAdminTab` usava `fetch` manual enquanto `useShopeeAchadinhos()`/`useReviewAchadinho()` já existiam. Migrado — dedup e cache de graça, lógica deixa de estar duplicada |
| **Cobertura** | `app/api/shopee/ranking` (0% → coberto) e `ShopeeProductCard`. Somado ao `ShopeeConfigTab.test.tsx` criado após o incidente de produção |
| **Auto-deploy** | `--squash` → `--merge`. O squash fazia `main` e `develop` divergirem por construção; todo sync virava merge com risco de conflito — foi assim que hooks duplicados voltaram e quebraram a produção |

### Incidente de produção no meio da rodada

A aba Shopee em Configuração caiu em "Algo deu errado". Causa: os dois
`useEffect` do seletor de hashtag foram inseridos **dentro** do
`if (loading) { ... }`, então sumiam quando o config carregava — React
derrubava a árvore com *"Rendered fewer hooks than expected"*.

Typecheck, build e 1202 testes ficaram verdes: **nenhum teste renderizava o
componente**. Era exatamente uma das superfícies sem cobertura listadas na
primeira rodada. O teste agora existe e foi verificado contra a versão
quebrada antes de ser aceito.

Reincidiu uma vez: o merge `main → develop` uniu as duas versões do arquivo e
duplicou os hooks. O teste pegou em segundos — e motivou a troca de squash
por merge commit.

## Descobertas sobre a API da EchoTik

Medido, não suposto:

- **`/realtime/video/search` devolve vazio** — `code=0`, `msg=ok`, envelope
  completo e localizado em pt-BR, `aweme_list: []`. Vale até para o exemplo da
  própria documentação (`keyword=baby`, `region=US`). Endpoints irmãos
  funcionam com as mesmas credenciais, então é específico dele. Seria a fonte
  ideal (tem `publish_time=90` nativo). Pendente de contato com a EchoTik.
- **Busca offline está 238 dias defasada** — `/echotik/search/items` devolve
  30 vídeos BR, mas o mais recente é de 2025-12-12, contra 2026-08-06 do
  endpoint realtime. A regra §1 fala em "T+1"; na prática, para esta consulta,
  são 8 meses. Inviável para conteúdo recente.
- **`hashtag/video/list` não tem filtro de data** — só `hashtag_id`, `region`,
  `offset`, `count`. Por isso a guarda de idade é client-side.

## Remaining Follow-ups

- **GraphQL variables** — strictly better than interpolation, but the vendor uses a hand-rolled signature scheme over the exact payload string and its docs show inline queries. Needs live-credential verification before switching.
- **Cron job split** — analysed and deferred pending real `IngestionRun` statistics; see `aidlc-docs/audit.md`. Would add `DISCOVERED`/`TRANSCRIBED`/`EXTRACTED` to the status enum (a cheap `ALTER TYPE ... ADD VALUE`, not a re-cast).
- **Coverage reporting gap** — `lib/swr/useShopee.ts` has 14 tests but reports 0% in both coverage runs. Its tests live in the jsdom config, whose coverage `include` is `app/components/**`, while the node config never runs them. A one-line config change would fix the reporting; the code is covered.
- **Still untested** — `app/api/shopee/ranking` (a thin `findMany`), and the remaining Shopee components (`ShopeeProductCard`, the two details modals, `ShopeeCategoryDropdown`, `EditAffiliateModal`, `ShopeeConfigTab`).
- **Pre-existing debt** unchanged: no ESLint config, `EchotikRawResponse` growth, repo-root clutter (`Untitled-1.yml`, `clean-plans.js`, committed `out/`), no API versioning, SWR polling for async jobs.
