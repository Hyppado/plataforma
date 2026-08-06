# Build and Test Summary — Shopee Defect Remediation

**Date**: 2026-08-06
**Scope**: Shopee vertical defect remediation (7 items) + Vercel timeout hardening
**Branch**: `develop`

## Result

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | Clean |
| Unit tests (node) | `npm run test` | 1179 passed / 89 files |
| Component tests (jsdom) | `npm run test:components` | 113 passed / 11 files |
| Production build | `npm run build` | Success — all 23 routes compiled |
| Migration | `prisma migrate status` | 1 pending: `20260806120000_shopee_achadinho_status_enum` |

**Total: 1292 tests passing.** Shopee went from 0 tests to 165.

## Coverage (Shopee surfaces)

| Surface | Stmts | Funcs |
|---|---|---|
| `app/api/cron/shopee` | 100% | 100% |
| `lib/shopee/cron` | 96.07% | 100% |
| `lib/swr/useShopee.ts` | 91.30% | 77.77% |
| `app/api/admin/settings/shopee` | 84.84% | 100% |
| `lib/shopee` | 80.04% | 92.59% |
| `app/components/shopee` | 20.98% | 8.69% |
| `app/api/shopee/ranking` | 0% | 0% |

Coverage configs were corrected in this change: `lib/swr/**` is excluded from the
node config and included in the jsdom config, because those hooks are only
exercised by the component suite. Previously they reported 0% despite having tests.

## Build Instructions

```bash
npm install
npx prisma generate
npm run build
```

Vercel runs `npx prisma migrate deploy && npx prisma generate && next build`.

## Test Instructions

```bash
npm run test              # unit (node)
npm run test:components   # component (jsdom)
npm run test:all          # both
npm run test:e2e          # Playwright smoke (requires a running dev server)
npm run test:coverage     # unit + coverage report
```

## Migration Notes

`20260806120000_shopee_achadinho_status_enum` does three things in one transaction:

1. Creates the `ShopeeAchadinhoStatus` enum
2. Casts `ShopeeAchadinhoProduct.status` from TEXT, with `ELSE 'PENDING'` for any
   unexpected legacy value — a failed cast would fail the Vercel build and abort
   the deploy
3. Backfills the pre-gate backlog to `READY` where a product name and affiliate
   link exist, so the public feed is never empty between deploy and review

Applied automatically by the Vercel build, per environment. No manual step.

## Post-Deploy Verification

1. `/dashboard/shopee/achadinhos` renders items (backfill worked)
2. Admin → Shopee tab shows the queue with Approve/Reject controls
3. `/dashboard/shopee/ranking` still populated
4. After the next 6h cron: check `IngestionRun` rows for
   `shopee:ranking` / `shopee:achadinhos` — inspect `statsJson.partial`,
   `processed`, `remaining` to size the achadinhos backlog

Those `statsJson` figures are the input to the deferred producer/worker split
decision recorded in `aidlc-docs/audit.md`.

## Known Gaps

- E2E smoke tests not extended to Shopee pages
- `app/api/shopee/ranking` and 6 Shopee components remain untested
- Shopee GraphQL still uses inline queries rather than variables (needs
  live-credential verification against the vendor)
