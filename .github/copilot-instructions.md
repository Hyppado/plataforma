# Copilot Instructions — Hyppado

## Product

Hyppado is a TikTok Shop intelligence SaaS. Users discover trending videos, products, and creators filtered by region and period. Access requires authentication and an active subscription (provisioned via Hotmart webhook) or an admin-granted `AccessGrant`.

Full documentation: [docs/](docs/)

## Branding

Only **Hyppe** and **Hyppado** may appear as brand names — code, comments, prompts, UI text, commits, docs. Feature names: "Insight Hyppado", "Hyppado Trends". No external brand terminology.

## Stack

- Next.js 14.1 (App Router), TypeScript 5, React 18
- MUI v5 (Emotion, dark-first) — theme centralized in `app/theme.ts`
- Prisma 5.22 + PostgreSQL (Neon in production)
- NextAuth 4.24 — credentials provider (email + bcrypt)
- SWR 2.4 — client-side data fetching (hooks in `lib/swr/`)
- Vitest + Testing Library (unit/component) + Playwright (e2e)
- Resend (transactional email), Vercel Blob (images), OpenAI (Whisper + Chat Completions)
- Deployed on Vercel; function timeout 60s

## Project Structure

```
app/api/          → route handlers (thin — logic goes to lib/)
app/components/   → React components
app/dashboard/    → authenticated pages
lib/access/       → resolveAccess() — runtime access chain
lib/admin/        → admin services (config, notifications, quota)
lib/auth.ts       → NextAuth config + requireAuth/requireAdmin helpers
lib/echotik/      → Echotik integration (client, cron modules)
lib/email/        → Resend client, templates, setup/reset tokens
lib/hotmart/      → Hotmart integration (webhook, processor, plans, oauth)
lib/insight/      → AI video insight system (service + generate)
lib/prisma.ts     → PrismaClient singleton — ALWAYS use this
lib/settings.ts   → DB-backed config (getSetting, upsertSecretSetting, etc.)
lib/transcription/ → Whisper transcription system
lib/types/        → shared DTOs and domain types
lib/usage/        → quota enforcement and consumption
prisma/           → schema.prisma + migrations
__tests__/        → unit and component tests (mirrors lib/ and app/api/)
e2e/              → Playwright smoke and login tests
```

## Where Things Go

| What | Where |
|---|---|
| Business logic | `lib/<domain>/` |
| External API integrations | `lib/<domain>/` |
| Route handlers (thin) | `app/api/<domain>/route.ts` |
| React components | `app/components/<category>/` |
| SWR data hooks | `lib/swr/` |
| Shared types and DTOs | `lib/types/` |
| DB-backed config | `lib/settings.ts` |
| Page-level auth guard | `requireAuth()` / `requireAdmin()` |

## Mandatory Code Rules

1. **Prisma singleton**: always import from `lib/prisma.ts`. Never `new PrismaClient()`.
2. **Imports in route handlers**: use `@/` alias — no relative paths like `../../../../lib/`.
3. **Error handling**: every API route must have `try/catch` with `{ error: string }` JSON responses.
4. **Logging**: use `createLogger(source)` from `lib/logger.ts`. Never `console.log`.
5. **Types**: no `any` in domain types when a typed alternative exists.
6. **Client-side data**: use SWR — no `useEffect` + manual `fetch` for new data.
7. **Secret comparison**: always `timingSafeEqual` from Node `crypto` — never `===` on secrets.
8. **Fail closed**: if a required secret is absent, reject the request — never accept permissively.
9. **Theme colors**: reference palette tokens (`"primary.main"`, `"secondary.main"`) in `sx` props — never hardcode hex values that exist in the theme.

## Authentication — Every Route is Private

Every route in `app/api/**` requires server-side authentication. Mandatory pattern:

```ts
import { requireAuth, isAuthed } from "@/lib/auth";

const auth = await requireAuth();
if (!isAuthed(auth)) return auth; // returns 401
// auth.userId, auth.role now available
```

For admin routes: use `requireAdmin()` (returns 401 if unauthenticated, 403 if not ADMIN). Do not rely on middleware alone — every route needs its own guard.

**Valid exceptions** (no NextAuth session):
- `/api/webhooks/hotmart` — auth by HMAC/token with `timingSafeEqual`; fail closed if secret is absent
- `/api/cron/*` — auth by `CRON_SECRET` in `Authorization: Bearer`; also blocked locally if `VERCEL` env var is absent
- `/api/auth/reset-password` — public POST for password reset; always returns 200, never reveals if email exists
- `/api/auth/setup-password` — public GET/POST for token-based password creation

## Access Chain

Runtime resolution in `lib/access/resolver.ts` (`resolveAccess(userId)`):

1. User `status` — SUSPENDED or soft-deleted blocks access
2. `AccessGrant` — admin-issued override grants access despite no subscription
3. Active `Subscription` — grants access
4. Fallback — no access

Do not persist derived access state. Always resolve at runtime.

## Key Helpers — `lib/settings.ts`

- `getSetting(key)` — read plain DB setting
- `getSettingOrEnv(key, envVar)` — DB first, env var fallback
- `upsertSetting(key, value)` — write plain setting
- `getSecretSetting(key)` — decrypt AES-256-GCM secret
- `upsertSecretSetting(key, value)` — encrypt and store secret
- `hasSecretSetting(key)` — check existence without decrypting

Hotmart credentials: always use `getHotmartConfig()` from `lib/hotmart/config.ts`.

## Echotik — Critical Rule

`echotikRequest` (from `lib/echotik/client.ts`) must **only** be called from:
- Cron ingestion modules in `lib/echotik/cron/`
- Image upload cron (`uploadImages.ts`)
- Download URL caching cron (`cacheDownloadUrls.ts`)
- Image proxy `app/api/proxy/` (deprecated fallback)
- Transcription media module (fallback when cached URL is unavailable)

**Never** call `echotikRequest` from user-facing routes. All trending/video/product/creator data comes from the database pre-ingested by the cron.

**Regions** come from the `Region` DB table (`isActive=true`). Never use an `ECHOTIK_REGIONS` env var.

## Quota System

- Enforce before consuming: `enforceQuota(userId, type)` in `lib/usage/enforce.ts`
- Consume atomically: `consumeUsage(userId, type, idempotencyKey)` in `lib/usage/consume.ts`
- Types: `TRANSCRIPT`, `SCRIPT` (also used for insights), `INSIGHT`
- Do not duplicate quota logic. Do not re-implement in components or handlers.

## Database / Migrations

**Non-destructive first**: default approach is additive. Never drop columns/tables without a formal two-step migration (remove code references first, deploy, then drop).

Migration workflow:
1. Edit `prisma/schema.prisma`
2. `npx prisma migrate dev --name <description> --create-only`
3. **Read the generated SQL** — confirm no `DROP`, `DELETE`, `TRUNCATE`; confirm `ADD COLUMN` has a `DEFAULT` or is nullable
4. `npx prisma migrate dev` to apply locally
5. Commit both `schema.prisma` and the migration SQL file

Prohibited in production: `prisma db push`, `prisma migrate reset`, `--create-only` twice for the same migration.

## Theme — Palette Tokens

| Token | Hex | Usage |
|---|---|---|
| `primary.main` | `#2DD4FF` | Main brand cyan — links, active states |
| `primary.light` | `#6BE0FF` | Lighter cyan variant |
| `primary.dark` | `#00B8E6` | Darker cyan variant |
| `secondary.main` | `#FF2D78` | Accent pink — dialog titles, badges |
| `secondary.light` | `#FF5C9A` | Lighter pink |
| `secondary.dark` | `#E0256A` | Darker pink — hover states |

Use `"secondary.main"` in `sx`, never `"#FF2D78"`.

## Landing Page

- `SectionShell` — wraps sections; full-bleed backgrounds and overlays go in `backgroundSlot` prop, not in regular children.
- CTA buttons ("Quero acesso agora") scroll to `#planos` — do not change this target.
- Logo: use `app/components/ui/Logo.tsx` (simple) or `app/components/BrandLogo.tsx` (responsive headers). Do not create a new logo component.

## Admin Notes

- **`_count.subscriptions`** in users route counts all subscriptions regardless of status. Never filter by `status: "ACTIVE"` — would misclassify subscribers as deletable users.
- **`showOnLanding` toggle**: uses optimistic local state (`useState`) in `HotmartTab` — do not revert to prop-only state.
- **Cron routes**: always check for `VERCEL` env var early and return 403 if absent. Never remove this guard.
- **Admin dashboard**: `PlansCard` is in the config page (HotmartTab), not on the admin dashboard. Do not move it.

## Email

- All transactional email uses `lib/email/client.ts` (`sendEmail`). Do not create alternate email services.
- All templates must use the `wrapTemplate()` wrapper from `lib/email/templates.ts`.
- Password reset: always return 200 — never reveal if email exists.
- Hotmart provisioning: call `sendOnboardingEmail().catch(...)` — never let email failure break provisioning.
- Raw tokens never stored in DB — store SHA-256 hash only (`lib/email/setup-token.ts`).

## Anti-Patterns — Never Do These

- `new PrismaClient()` outside `lib/prisma.ts`
- `console.log` — use `createLogger`
- `useEffect` + `fetch` for new client-side data — use SWR
- Relative imports (`../../../../lib/...`) in route handlers — use `@/`
- Hardcoded hex colors that exist in theme palette
- `===` / `!==` to compare secrets — use `timingSafeEqual`
- Missing `try/catch` in API routes
- Missing `requireAuth`/`requireAdmin` guard in any `app/api/` route
- `prisma db push` or `prisma migrate reset` on Preview or Production
- Committing a migration without reading the generated SQL
- Calling `echotikRequest` from user-facing routes
- Regions from env vars — use the `Region` DB table
- Returning plaintext secrets to the client
- `Access-Control-Allow-Origin: *` on authenticated routes
- Brand names other than Hyppe / Hyppado
- Skipping validation before committing (see below)

## Mandatory Validation Before Committing

```bash
npx tsc --noEmit   # zero type errors
npm run build      # exit code 0
npm run test:all   # all 795+ tests passing
```

No exceptions. Fix before committing if any of these fail.
