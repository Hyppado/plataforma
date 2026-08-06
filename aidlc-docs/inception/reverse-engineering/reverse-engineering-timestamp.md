# Reverse Engineering Metadata

**Analysis Date**: 2026-08-06T00:00:00Z (refresh)
**Previous Analysis**: 2026-07-10T00:00:00Z
**Analyzer**: AI-DLC (Claude Opus 5)
**Workspace**: /Users/eve/Projetos/hyppado
**Branch analyzed**: `develop` @ `87e524b`
**Total Source Files Analyzed**: 419 (`.ts` / `.tsx` / `.mjs`, excluding `node_modules`)
**Total DB Models**: 42 (`prisma/schema.prisma`, 33 migrations)
**Total API Route Handlers**: 93 (`route.ts`)

## Artifacts Generated

- [x] business-overview.md
- [x] architecture.md
- [x] code-structure.md
- [x] api-documentation.md
- [x] component-inventory.md
- [x] technology-stack.md
- [x] dependencies.md
- [x] code-quality-assessment.md
- [x] reverse-engineering-timestamp.md (this file)

## Why This Refresh Ran

Explicit user request ("update the reverse-engineering"). Per `inception/workspace-detection.md` Step 3, an explicit rerun request triggers Reverse Engineering regardless of staleness. The artifacts were in fact stale: the codebase gained an entire new business vertical after the previous run.

## What Changed Since 2026-07-10

| Commit | Change |
|---|---|
| `d5321bd` / `8c46191` (PR #101) | **Shopee vertical** — Ranking Shopee and Achadinhos Shopee tabs plus their ingestion, insight, and transcription functionality |
| `c097772` | **Deploy** — `prisma migrate deploy` moved into the Vercel `buildCommand`; migrations now apply automatically per environment |
| `87e524b` / `7b76d76` | Merges of `main` into `develop` and the corresponding PR |

**Concretely**:
- 2 new Prisma models (`ShopeeProductTrend`, `ShopeeAchadinhoProduct`) and 5 new migrations
- 7 new `lib/shopee/*` modules plus `lib/swr/useShopee.ts` (~2,300 lines)
- 9 new Shopee React components (~3,700 lines)
- 2 new dashboard pages, 5 new API routes (3 user-facing, 1 cron, 1 admin)
- 2 new Vercel cron entries (`?task=ranking`, `?task=achadinhos`, both `0 */6 * * *`)
- 8 new `shopee.*` runtime settings; 3 new environment variables (all optional fallbacks)
- CSP and `next.config.js` image allow-lists widened for Shopee CDN hosts
- `lib/echotik/client.ts` extended with hashtag video list and video captions endpoints
- `lib/transcription/media.ts` extended with `getVideoCaptions()` and `parseCaptionToPlainText()`
- **Zero npm dependency changes**

## Corrections to the Previous Analysis

- **Prisma model count**: previously reported as 27. The actual count was 40 before the Shopee release and is **42** now.
- **Cron HTTP method**: cron routes were documented as `POST`; all five are `GET`.
- **Migration timing**: previously "Prisma migrations run automatically on Vercel deploy" — that was aspirational at the time (`docs/deploy.md` said the opposite). It is now true as of `c097772`.

## Key Findings Summary

- **Project Type**: B2C SaaS — social-commerce intelligence + AI content creation for the Brazilian market. No longer TikTok-only: Shopee is now a first-class second vertical with direct affiliate monetization.
- **Architecture**: Next.js 14 monolith (App Router), Vercel-hosted, Neon PostgreSQL — unchanged in shape; the Shopee module follows the existing `lib/<domain>/` convention.
- **Primary AI Integrations**: Google Gemini (GenAI), OpenAI (Whisper + GPT, now including `gpt-4o-mini` for product-name extraction)
- **Data Sources**: EchoTik API (TikTok Shop trends, hashtag videos, captions) and Shopee Affiliate GraphQL API (product search, affiliate short links)
- **Billing**: Hotmart webhooks → subscription lifecycle management
- **Compliance**: LGPD — consent records, soft delete, erasure requests
- **Security Posture**: Still strong — nonce-based CSP, HMAC webhook verification, SHA-256 Shopee request signing, AES-256-GCM secret encryption, `timingSafeEqual` cron auth, brute-force protection, HSTS
- **Test Health**: Good on the original surface (90 test files), **but the ~5,000-line Shopee vertical has no tests at all** — the single largest quality gap identified in this refresh
- **Notable defects found**: `ShopeeAchadinhoProduct.category` is never populated (category filter is inert); the documented `PENDING → READY` admin-approval gate is not implemented; two exported Shopee functions are dead code; the ranking table rebuild is non-transactional. Details and a prioritized remediation list are in `code-quality-assessment.md`.
