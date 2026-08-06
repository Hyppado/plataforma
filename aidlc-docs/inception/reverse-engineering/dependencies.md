# Dependencies

> **Last updated**: 2026-08-06 (refresh — the Shopee release added **no npm dependencies**; it adds one external service and four environment variables)

## Internal Dependencies

All modules are co-located in the same Next.js monolith. Key internal dependency flows:

```
API Routes
    --> lib/auth.ts (requireAuth / requireAdmin)
    --> lib/prisma.ts (DB access)
    --> lib/[domain]/ (business logic)
    --> lib/usage/ (quota enforcement for AI features)
    --> lib/logger.ts (logging)

lib/access/resolver.ts
    --> lib/prisma.ts
    --> lib/usage/quota.ts

lib/hotmart/processor.ts
    --> lib/prisma.ts
    --> lib/access/resolver.ts
    --> lib/email/
    --> lib/logger.ts

lib/transcription/service.ts
    --> lib/prisma.ts
    --> lib/transcription/whisper.ts
    --> lib/transcription/media.ts
    --> lib/storage/
    --> lib/usage/

lib/insight/
    --> lib/prisma.ts
    --> lib/usage/
    --> lib/settings.ts (AI API keys)

lib/influencer-ia/
    --> lib/prisma.ts
    --> lib/usage/
    --> lib/storage/
    --> @google/genai

lib/echotik/cron/
    --> lib/echotik/client.ts
    --> lib/prisma.ts
    --> lib/storage/
    --> lib/logger.ts

lib/shopee/cron/syncShopee.ts
    --> lib/shopee/client.ts        (ranking sync)
    --> lib/shopee/pipeline.ts      (achadinhos pipeline)
    --> lib/settings.ts             (frequency + batch size)
    --> lib/prisma.ts               (IngestionRun bookkeeping)

lib/shopee/client.ts
    --> lib/shopee/shopee-api-client.ts
    --> lib/shopee/shopee-categories.ts
    --> lib/echotik/client.ts
    --> lib/settings.ts
    --> lib/prisma.ts

lib/shopee/pipeline.ts
    --> lib/shopee/shopee-api-client.ts
    --> lib/shopee/client.ts
    --> lib/shopee/types.ts
    --> lib/echotik/client.ts       (fetchVideosByHashtag)
    --> lib/transcription/media.ts  (captions, download URL, buffer)
    --> lib/transcription/whisper.ts
    --> lib/settings.ts             (OpenAI key)
    --> lib/prisma.ts

lib/shopee/shopee-api-client.ts
    --> lib/settings.ts             (encrypted credentials, env fallback)
    --> node:crypto                 (SHA-256 signing)

app/dashboard/shopee/*  and  app/components/shopee/*
    --> lib/swr/useShopee.ts
    --> lib/shopee/adapters.ts      (reuse TikTok ProductCard/VideoCard)
    --> lib/shopee/shopee-categories.ts

middleware.ts
    --> next-auth/middleware
    --> nextjs crypto (nonce)
```

**Note on coupling**: `lib/shopee/pipeline.ts` depends on `lib/transcription/*` and `lib/echotik/client.ts`. The Shopee vertical is therefore not independent of the EchoTik integration — an EchoTik outage or credential change degrades achadinhos ingestion (though the Shopee *ranking* sync is EchoTik-free and stays healthy).

## External Dependencies

### Core Framework
| Dependency | Version | Purpose |
|---|---|---|
| `next` | 14.2.35 | Full-stack React framework |
| `react` | 18.2 | UI library |
| `react-dom` | 18.2 | React DOM renderer |
| `typescript` | 5.3.x | Type-safe language |

### Database
| Dependency | Version | Purpose |
|---|---|---|
| `@prisma/client` | 5.22.0 | ORM client (generated) |
| `prisma` | 5.22.0 | CLI for migrations/codegen |
| `pg` | 8.20.0 | PostgreSQL driver (dev/test) |

### Authentication
| Dependency | Version | Purpose |
|---|---|---|
| `next-auth` | 4.24.13 | Auth framework (credentials + JWT) |
| `bcryptjs` | 3.0.3 | Password hashing |

### AI / ML
| Dependency | Version | Purpose |
|---|---|---|
| `@google/genai` | 2.1.0 | Google Gemini API client |

### Storage
| Dependency | Version | Purpose |
|---|---|---|
| `@vercel/blob` | 2.3.3 | Vercel Blob object storage |
| `@vercel/functions` | 3.4.3 | Vercel serverless utilities |

### Email
| Dependency | Version | Purpose |
|---|---|---|
| `resend` | 6.10.0 | Transactional email API |

### UI
| Dependency | Version | Purpose |
|---|---|---|
| `@mui/material` | 5.15.x | MUI component library |
| `@mui/icons-material` | 5.15.x | MUI icon set |
| `@emotion/react` | 11.11.x | CSS-in-JS (required by MUI) |
| `@emotion/styled` | 11.11.x | Styled components (required by MUI) |

### Data Fetching
| Dependency | Version | Purpose |
|---|---|---|
| `swr` | 2.4.1 | Client-side data fetching with caching |

### Image Processing
| Dependency | Version | Purpose |
|---|---|---|
| `sharp` | 0.34.5 | Server-side image processing |

### Testing (dev)
| Dependency | Version | Purpose |
|---|---|---|
| `vitest` | 4.1.0 | Test runner |
| `@testing-library/react` | 14.3.1 | Component test utilities |
| `@testing-library/user-event` | 14.6.1 | User event simulation |
| `@vitest/coverage-v8` | 4.1.0 | Coverage reporting |
| `@playwright/test` | 1.58.2 | E2E browser testing |
| `jsdom` | 28.1.0 | DOM simulation |
| `@vitejs/plugin-react` | 4.7.0 | Vite React plugin for Vitest |
| `vite-tsconfig-paths` | 6.1.1 | TS path alias support in Vitest |

### Build (dev)
| Dependency | Version | Purpose |
|---|---|---|
| `tsx` | 4.7.0 | TypeScript execution (scripts, seeds) |

## Key External Service Dependencies

| Service | Auth Method | Criticality |
|---|---|---|
| Neon (PostgreSQL) | Connection string | Critical — all data |
| EchoTik API | HTTP Basic auth (username/password) | High — TikTok trending data **and** achadinhos video discovery/captions |
| Hotmart | OAuth2 client credentials + HMAC webhook | High — billing |
| OpenAI | API key (stored encrypted in DB) | High — transcription, insights, Shopee product extraction |
| Shopee Affiliate Open API | SHA-256 signed requests (App ID + Secret, encrypted in DB, env fallback) | High — Shopee ranking and affiliate monetization |
| Google Gemini | API key (stored encrypted in DB) | High — Influencer IA + Avatar Video |
| Vercel Blob | Vercel token | Medium — asset storage |
| Shopee CDN (`susercontent.com`, `shopee.com.br`) | None — public hot-linking | Medium — Shopee product images are not cached locally |
| Resend | API key | Medium — email delivery |

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection (app) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | Base URL for auth redirects |
| `HOTMART_CLIENTE_ID` | Hotmart OAuth2 client ID |
| `HOTMART_CLIENT_SECRET` | Hotmart OAuth2 client secret |
| `HOTMART_BASIC` | Hotmart basic auth (base64 encoded) |
| `HOTMART_WEBHOOK_SECRET` | HMAC key for webhook verification |
| `ECHOTIK_BASE_URL` | EchoTik API base URL |
| `ECHOTIK_USERNAME` | EchoTik HTTP Basic auth username |
| `ECHOTIK_PASSWORD` | EchoTik HTTP Basic auth password |
| `CRON_SECRET` | Token for authenticating cron job requests (compared with `timingSafeEqual`; missing value = fail-closed 500) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token |
| `SHOPEE_AFFILIATE_APP_ID` | Shopee Affiliate App ID — **fallback only**; the encrypted `Setting` takes priority |
| `SHOPEE_AFFILIATE_API_SECRET` | Shopee Affiliate API Secret — **fallback only**; the encrypted `Setting` takes priority |
| `SHOPEE_HASHTAG_ID` | Overrides the achadinhos hashtag ID at runtime; **highest priority**, above the Setting and the built-in default (`1696392324325382`) |
| `VERCEL` | Set by the platform; all cron routes refuse to run when it is unset |
| OpenAI API key | Stored encrypted in `Setting` table via admin |
| Google Gemini API key | Stored encrypted in `Setting` table via admin |

## Runtime Settings (`Setting` table, not env vars)

The Shopee module is tuned entirely at runtime through the admin panel. Keys live in `SETTING_KEYS` (`lib/settings.ts`):

| Key | Default | Purpose |
|---|---|---|
| `shopee.affiliate_app_id` | — | App ID (secret, AES-256-GCM encrypted) |
| `shopee.affiliate_api_secret` | — | API Secret (secret, AES-256-GCM encrypted) |
| `shopee.ranking_limit` | `50` | Maximum products kept in the ranking snapshot |
| `shopee.ranking_frequency` | `24` (hours) | Effective cadence of the ranking sync |
| `shopee.achadinhos_frequency` | `12` (hours) | Effective cadence of the achadinhos pipeline |
| `shopee.achadinhos_count` | `50` | Videos per pipeline run, clamped `20..400` |
| `shopee.achadinhos_hashtag_id` | `1696392324325382` | EchoTik hashtag ID for `#achadinhosshopee` |
| `shopee.achadinhos_keyword` | `achadinhosshopee` | Textual keyword (declared in `SETTING_KEYS`; not read by the current pipeline) |
