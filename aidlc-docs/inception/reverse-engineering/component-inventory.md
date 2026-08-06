# Component Inventory

> **Last updated**: 2026-08-06 (refresh — adds Shopee pages, components, and modules; corrects counts)

## Application Packages / Modules

This is a Next.js monolith — all code lives in a single package. Logical modules are separated by directory.

### Frontend Pages
| Page | Path | Purpose |
|---|---|---|
| Landing Page | `app/page.tsx` | Public marketing page with plans, features, FAQ |
| Login | `app/login/page.tsx` | Credentials login form |
| Password Setup | `app/criar-senha/page.tsx` | First-time password setup (token-based) |
| Password Recovery | `app/recuperar/page.tsx` | Password reset initiation |
| Dashboard Home | `app/dashboard/home/page.tsx` | Dashboard landing/overview |
| Videos | `app/dashboard/videos/page.tsx` | Trending videos listing |
| Saved Videos | `app/dashboard/videos-salvos/page.tsx` | User's saved videos |
| Products | `app/dashboard/products/page.tsx` | Trending products listing |
| Saved Products | `app/dashboard/produtos-salvos/page.tsx` | User's saved products |
| Creators | `app/dashboard/creators/page.tsx` | Trending creators listing |
| Trends | `app/dashboard/trends/page.tsx` | Trend analysis overview |
| **Ranking Shopee** | `app/dashboard/shopee/ranking/page.tsx` | **Shopee best-seller ranking (cards/list, category tree, sort chips)** |
| **Achadinhos Shopee** | `app/dashboard/shopee/achadinhos/page.tsx` | **Feed of TikTok videos matched to Shopee products** |
| Influencer IA | `app/dashboard/influencer-ia/page.tsx` | AI content wizard |
| Prompt Library | `app/dashboard/prompt-library/page.tsx` | Curated AI prompts |
| Config | `app/dashboard/config/page.tsx` | User settings/profile |
| Support | `app/dashboard/suporte/page.tsx` | Support request form |
| Admin Panel | `app/dashboard/admin/page.tsx` | Admin operations (tabs: Assinantes, Custos, Shopee, …) |
| Admin Notifications | `app/dashboard/admin/notificacoes/page.tsx` | Notification center |
| Privacy Policy | `app/privacidade/page.tsx` | Public privacy policy |
| Terms of Use | `app/termos/page.tsx` | Public terms of use |
| Support (public) | `app/suporte/page.tsx` | Public support page |

### UI Component Groups
| Group | Path | Purpose |
|---|---|---|
| Cards | `app/components/cards/` | VideoCard, ProductCard, ProductDetailsModal, RankBadge, Skeletons |
| Dashboard Layout | `app/components/dashboard/` | Sidebar (now with a SHOPEE nav section), Header, DataTable, password guards |
| Admin | `app/components/admin/` | Admin tabs: users, subscribers, hotmart, echotik, AI, prompts, notifications, **Shopee** |
| Filters | `app/components/filters/` | CategoryFilter, TimeRangeSelect |
| Landing | `app/components/landing/` | Hero, Pricing, FAQ, HowItWorks, ForWho sections |
| Layout | `app/components/layout/` | App top bar, notifications bell, quota display, profile dialog |
| **Shopee** | `app/components/shopee/` | **Achadinho and product cards, details modals, category dropdown, affiliate-link editor** |
| Videos | `app/components/videos/` | InsightDialog, TranscriptDialog, TikTokPlayerModal |
| UI Primitives | `app/components/ui/` | Logo, Skeleton, CookieBanner |

### Shopee Components (detail)
| Component | Path | Lines | Purpose |
|---|---|---|---|
| ShopeeAchadinhoCard | `app/components/shopee/ShopeeAchadinhoCard.tsx` | 881 | Feed card: cover, views, sales, price, commission, transcript, affiliate CTA, admin edit |
| ShopeeProductDetailsModal | `app/components/shopee/ShopeeProductDetailsModal.tsx` | 508 | Ranking product detail view |
| ShopeeAchadinhoDetailsModal | `app/components/shopee/ShopeeAchadinhoDetailsModal.tsx` | 464 | Achadinho detail view with TikTok embed |
| ShopeeAchadinhoVideoCard | `app/components/shopee/ShopeeAchadinhoVideoCard.tsx` | 329 | Video-first card variant |
| ShopeeCategoryDropdown | `app/components/shopee/ShopeeCategoryDropdown.tsx` | 308 | Two-level category/subcategory picker |
| ShopeeProductCard | `app/components/shopee/ShopeeProductCard.tsx` | 272 | Ranking grid card |
| EditAffiliateModal | `app/components/shopee/EditAffiliateModal.tsx` | 244 | Admin-only affiliate link override |
| ShopeeAdminTab | `app/components/admin/ShopeeAdminTab.tsx` | 380 | Admin curation of ingested achadinhos |
| ShopeeConfigTab | `app/components/admin/shopee/ShopeeConfigTab.tsx` | 279 | Credentials + frequency/limit/hashtag tuning |

### Backend Service Modules (lib/)
| Module | Path | Purpose |
|---|---|---|
| Auth | `lib/auth.ts` | NextAuth config, auth helpers, rate limiting |
| Access Resolver | `lib/access/resolver.ts` | Compute user access status |
| Crypto | `lib/crypto.ts` | AES-256-GCM for stored secrets |
| Logger | `lib/logger.ts` | Structured logging |
| Settings | `lib/settings.ts` | Dynamic key-value settings from DB (incl. 8 `shopee.*` keys) |
| Prisma Client | `lib/prisma.ts` | Singleton Prisma client |
| EchoTik Client | `lib/echotik/client.ts` | EchoTik HTTP client; hashtag video list + captions endpoints |
| EchoTik Trending | `lib/echotik/trending.ts` | Trending data fetchers |
| EchoTik Cron | `lib/echotik/cron/` | Cron job ingestion logic |
| **Shopee API Client** | `lib/shopee/shopee-api-client.ts` | **Shopee Affiliate GraphQL client, SHA-256 signing** |
| **Shopee Client** | `lib/shopee/client.ts` | **Ranking sync, hashtag resolution, EchoTik mapping** |
| **Shopee Pipeline** | `lib/shopee/pipeline.ts` | **Achadinhos AI ingestion pipeline** |
| **Shopee Cron** | `lib/shopee/cron/syncShopee.ts` | **Frequency gating + run bookkeeping** |
| **Shopee Adapters** | `lib/shopee/adapters.ts` | **Shopee DTO → TikTok ProductDTO/VideoDTO** |
| **Shopee Categories** | `lib/shopee/shopee-categories.ts` | **productCatIds → category names, category tree** |
| **Shopee Types** | `lib/shopee/types.ts` | **Defaults, ranking keywords, GPT prompt builder** |
| Hotmart Client | `lib/hotmart/client.ts` | Hotmart API client (OAuth2) |
| Hotmart Processor | `lib/hotmart/processor.ts` | Subscription event processor |
| Hotmart Webhook | `lib/hotmart/webhook.ts` | Webhook verification + routing |
| Transcription | `lib/transcription/` | Whisper pipeline + EchoTik captions + caption parsing |
| Insight | `lib/insight/` | AI insight generation |
| Influencer IA | `lib/influencer-ia/` | AI content wizard logic |
| Avatar Video | `lib/avatar-video/` | Avatar video creation flow |
| Storage | `lib/storage/` | Vercel Blob operations |
| Email | `lib/email/` | Transactional email (Resend) |
| Exchange | `lib/exchange/` | Exchange rate management |
| LGPD | `lib/lgpd/` | Consent and data erasure |
| Usage / Quota | `lib/usage/` | Usage tracking and quota enforcement |
| Sync | `lib/sync/` | DB sync utilities |
| Prompt Library | `lib/prompt-library/` | Prompt library queries |
| Admin | `lib/admin/` | Admin-specific business logic |
| SWR Hooks | `lib/swr/` | Client-side data fetching hooks (incl. `useShopee.ts`) |
| Filters | `lib/filters/` | Dashboard query filter helpers |
| Categories | `lib/categories.ts` | Category utility functions |
| Region | `lib/region.ts` | Region/country utilities |
| Format | `lib/format.ts` | Number, currency, date formatting |
| View Mode | `lib/useViewMode.ts` | Card/list toggle hook |

### Test Suites
| Suite | Path | Purpose |
|---|---|---|
| API Tests | `__tests__/api/` | API route integration tests (mocked DB) — 38 files |
| Component Tests | `__tests__/components/` | React component unit tests (jsdom) — 8 files |
| Lib Tests | `__tests__/lib/` | Business logic unit tests — 40 files |
| Security Tests | `__tests__/security.test.ts` | Security header and auth tests |
| Middleware Tests | `__tests__/middleware.test.ts` | Edge middleware tests |
| E2E Tests | `e2e/login.spec.ts`, `e2e/smoke.spec.ts` | Playwright smoke tests against dev server |

> **Coverage gap**: there is **no test file referencing Shopee anywhere** in `__tests__/` or `e2e/`. See `code-quality-assessment.md`.

### Configuration Files
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (**42 models**) |
| `middleware.ts` | Edge middleware (CSP incl. Shopee CDNs, auth, role checks) |
| `next.config.js` | Next.js config (headers, `images.remotePatterns` incl. Shopee CDNs, external packages) |
| `vercel.json` | Vercel deployment (**5 cron entries**, function timeouts, build-time `prisma migrate deploy`) |
| `tsconfig.json` | TypeScript config |
| `vitest.config.ts` | Unit test config (node env) |
| `vitest.component.config.ts` | Component test config (jsdom env) |
| `playwright.config.ts` | E2E test config |

### Scripts (diagnostic/admin)
| Script | Purpose |
|---|---|
| `scripts/sync-db.ts` | Manual DB sync trigger |
| `scripts/import-subscribers.ts` | Bulk subscriber import |
| `scripts/grant-admin-user-access.ts` | Grant manual access to a user |
| `scripts/cleanup-members.ts` | Clean up inactive members |
| `scripts/test-cron-tasks.ts` | Exercise cron task entry points locally |
| `scripts/diag-*.mjs` | Various diagnostic/debug scripts |
| `prisma/create-admin.ts` | Create first admin user |
| `prisma/seed.ts` | Seed default data (plans, scenarios, regions) |
| `prisma/cleanupAchadinhos.ts` | **Purge achadinhos below the 30k-view relevance threshold** |

## Total Count
- **Total Packages**: 1 (Next.js monolith)
- **Application Pages**: 23 `page.tsx` files
- **UI Component Groups**: 9 (71 `.tsx` component files)
- **Backend Service Modules**: 30+ (102 `.ts` files under `lib/`)
- **API Route Handlers**: 93 `route.ts` files
- **Prisma Models**: 42 (33 migrations)
- **Test Files**: 90 (88 Vitest + 2 Playwright specs)
- **Cron Jobs**: 5 scheduled + 1 on-demand (`/api/cron/transcribe`)
