# Copilot Instructions — Hyppado

## Product

Hyppado is a TikTok Shop intelligence SaaS.
It helps users discover trending videos, products, and creators, filtered by region and time period.
Access is authenticated and part of the experience depends on subscription/access control via Hotmart.

## Purpose of These Instructions

These instructions exist to maintain architectural consistency, security, readability, and compatibility.
Before proposing changes, understand how the project currently works and preserve decisions that are already correct.
Do not introduce unnecessary complexity.

## Git Workflow

- Work on the `develop` branch.
- For production, open a PR from `develop` to `main`.
- Do not push directly to `main`, except for critical hotfixes.
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
    admin/         → protected admin routes
    auth/          → NextAuth handlers
    cron/          → cron endpoints (echotik, hotmart reconcile)
    echotik/       → Echotik data endpoints
    me/            → authenticated user profile
    proxy/         → external image proxy
    regions/       → active regions
    trending/      → trending data
    usage/         → user quotas
    user/          → user data
    webhooks/      → external webhooks (Hotmart)
  components/
    BrandLogo.tsx  → responsive logo component (uses next/image)
    admin/         → admin area components
    cards/         → video, product, creator, rank cards
    dashboard/     → authenticated dashboard components
    filters/       → CategoryFilter, TimeRangeSelect etc.
    landing/       → landing page components
    layout/        → shared layout (sidebar, header)
    ui/            → reusable primitives (Logo, etc.)
    videos/        → video-specific components
  dashboard/       → authenticated pages (/dashboard/*)
  login/           → login page
  theme.ts         → centralized MUI theme
lib/
  access/          → access control (AccessGrant, subscription)
  admin/           → admin services
    admin-client.ts
    config.ts
    notifications.ts
    prompt-config.ts
    useQuotaUsage.ts
  auth.ts          → NextAuth config + callbacks
  categories.ts    → category mapping
  echotik/
    client.ts      → HTTP client for Echotik API
    cron/          → ingestion cron modules
      orchestrator.ts  → detectNextTask() → {task, region} | null
      helpers.ts       → getConfiguredRegions() reads Region table from DB
      syncVideos.ts    → syncVideoRanklist(runId, region, log)
      syncProducts.ts  → syncProductRanklist(runId, region, log)
      syncCreators.ts  → syncCreatorRanklist(runId, region, log)
      syncCategories.ts
      index.ts
      types.ts
    dates.ts / products.ts / rankFields.ts / trending.ts
  filters/         → shared filter utilities
  format.ts        → number, date, currency formatters
  hotmart/
    client.ts / config.ts / oauth.ts
    processor.ts   → webhook event processing
    reconcile.ts   → subscription reconciliation
    sync.ts / webhook.ts
  lgpd/            → consent and personal data (GDPR)
  logger.ts        → createLogger(source, correlationId) → structured Logger
  prisma.ts        → PrismaClient singleton (ALWAYS use this)
  region.ts        → region helpers
  settings.ts      → database-backed configuration
  storage/         → file storage
  swr/
    fetcher.ts     → default SWR fetcher
    useCategories.ts
    useTrending.ts
  types/
    admin.ts       → admin area types
    dto.ts         → shared DTOs
    echotik.ts     → Echotik API types
  usage/           → quota and plan limit logic
prisma/
  schema.prisma    → Prisma schema (includes Region model)
  seed.ts          → seed with default regions BR, US, JP
__tests__/
  api/             → route handler tests
  components/      → RTL component tests (jsdom)
    setup.tsx      → setup: jest-dom, mocks for MUI/Next/auth
    CategoryFilter.test.tsx
    LoginPage.test.tsx
    Logo.test.tsx
    RankBadge.test.tsx
    TimeRangeSelect.test.tsx
    VideoCardSkeleton.test.tsx
  lib/             → business logic tests
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
- Shared types: `lib/types/dto.ts`, `lib/types/admin.ts`, `lib/types/echotik.ts`
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
- Reconciliation: dedicated cron → `lib/hotmart/reconcile.ts`
- Admin notifications: `lib/admin/notifications.ts`
- New changes must preserve: retry, auditability, separation of reception/processing,
  compatibility with the current subscription and reconciliation flow.

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

## Logs and Observability

- Use `createLogger(source, correlationId)` from `lib/logger.ts` — returns a structured `Logger`.
- Never use `console.log` for loose debugging.
- Log only genuinely significant operational events.
- Preserve auditability of admin actions and relevant events.
- Do not leak secrets, tokens, or sensitive payloads in logs.
- In cron and integrations, pass the `logger` created at the start of the invocation throughout the chain.

## Admin

- The admin area must remain protected on the server.
- Services in `lib/admin/`: `admin-client.ts`, `config.ts`, `notifications.ts`, `prompt-config.ts`, `useQuotaUsage.ts`.
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

### Current Counts (reference — March 2026)

- **417 unit tests** (vitest, node env, `__tests__/lib/`, `__tests__/api/`, etc.)
- **46 component tests** (vitest, jsdom env, `__tests__/components/`)
- **Total: 463 tests**, all passing

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

Pipeline in `.github/workflows/ci.yml`, runs on push/PR to `develop` and `main`.

Jobs in dependency order:

1. **typecheck** — `npx tsc --noEmit` + `prisma generate`
2. **unit-tests** — `npm run test` + `npm run test:components`
3. **build** — `npm run build`
4. **e2e-smoke** — `playwright test --project=chromium` (depends on build)

Playwright failure artifacts are uploaded to `e2e/.artifacts/` (retention: 7 days).

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

## Maintenance Priorities When Working on the Project

1. security
2. functional compatibility
3. access and quota rules
4. Hotmart/Echotik/cron integrity
5. tests
6. organization and componentization
7. cosmetic improvements

## Mandatory Validation Before Marking a Task as Done

- Run `npm run build` and confirm exit code 0.
- Run `npm run test:all` and confirm that all 463 tests pass.
- If the build or tests break, fix before committing.
- This applies to any change: refactoring, file removal, new feature, fix.

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
