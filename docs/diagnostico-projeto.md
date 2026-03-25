# Diagnóstico Completo — Hyppado

> Gerado em: Junho 2025
> Branch: `develop` • Último commit auditado: `69fbdcf`

---

## ETAPA 1 — Visão Geral Real do Projeto

### O que o Hyppado faz

**Hyppado é uma plataforma SaaS de inteligência de mercado para TikTok Shop.** Permite que empreendedores e criadores de conteúdo encontrem produtos, vídeos e creators em alta no TikTok, com rankings por região e período.

**Fluxos principais:**

1. **Visitante** → Landing page → Planos → Checkout Hotmart → Cadastro
2. **Assinante** → Login → Dashboard com rankings (vídeos, produtos, creators, tendências) → Salvar itens → Transcrições/Insights (quota)
3. **Admin** → Dashboard com métricas de assinatura, gerência de quotas, logs de auditoria, notificações

### Stack

| Camada    | Tecnologia                | Versão  |
| --------- | ------------------------- | ------- |
| Framework | Next.js (App Router)      | 14.1.0  |
| UI        | MUI (Material UI)         | 5.15.x  |
| ORM       | Prisma                    | 5.22.0  |
| Banco     | PostgreSQL (Neon em prod) | —       |
| Auth      | NextAuth                  | 4.24.13 |
| Testes    | Vitest                    | 4.1.0   |
| Deploy    | Vercel                    | —       |
| Pagamento | Hotmart (webhooks)        | —       |
| Dados     | Echotik API (TikTok data) | —       |
| Runtime   | Node.js                   | ≥ 20    |

**Dependências runtime:** 12 pacotes — lean.  
**Dev deps:** Prisma CLI, Vitest, TypeScript 5.3, @types/\*.

### Estrutura de Diretórios

```
hyppado/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page (3.592 linhas!)
│   ├── layout.tsx              # Root layout (35 linhas, server component)
│   ├── theme.ts                # MUI theme para landing
│   ├── providers.tsx           # SessionProvider wrapper
│   ├── login/page.tsx          # Login (397 linhas, próprio theme)
│   ├── api/                    # 37 route handlers
│   │   ├── admin/              # 13 rotas admin (notifications, plans, users, etc)
│   │   ├── auth/[...nextauth]  # NextAuth handler
│   │   ├── cron/               # 2 crons (echotik, hotmart-reconcile)
│   │   ├── echotik/            # 4 rotas (categories, products)
│   │   ├── trending/           # 3 rotas (videos, products, creators)
│   │   ├── webhooks/hotmart    # Webhook receiver
│   │   ├── proxy/image         # CDN proxy
│   │   ├── regions             # Regiões disponíveis
│   │   └── me, user, usage     # Rotas do usuário
│   ├── app/                    # Área autenticada
│   │   ├── layout.tsx          # Shell + sidebar + theme (700 linhas)
│   │   ├── admin/page.tsx      # Admin dashboard (1.016 linhas)
│   │   ├── videos/page.tsx     # Rankings de vídeos (300 linhas)
│   │   ├── products/page.tsx   # Rankings de produtos (280 linhas)
│   │   ├── creators/page.tsx   # Rankings de creators (182 linhas)
│   │   ├── trends/page.tsx     # Novos produtos (220 linhas)
│   │   ├── assinatura/page.tsx # Gestão de assinatura (955 linhas)
│   │   ├── videos-salvos/      # Vídeos salvos (130 linhas)
│   │   ├── produtos-salvos/    # Produtos salvos (130 linhas)
│   │   └── suporte/            # Suporte (137 linhas)
│   └── components/             # 19 componentes
│       ├── cards/              # VideoCardPro (797), CreatorTable, ProductCard
│       ├── dashboard/          # VideoCard (611), DataTable, RightPanel, etc
│       ├── filters/            # DashboardHeader, SearchFilters
│       ├── layout/             # AppTopHeader (213)
│       ├── ui/                 # Logo, BrandLogo, EmptyState, ZeroState
│       └── videos/             # TranscriptDialog (176), InsightDialog (222)
├── lib/                        # Lógica de negócio
│   ├── access/resolver.ts      # Cadeia de acesso (177 linhas)
│   ├── admin/                  # notifications.ts, admin-client.ts, useQuotaUsage
│   ├── auth.ts                 # NextAuth config + dev bypass
│   ├── categories.ts           # Cache de categorias
│   ├── echotik/                # Client, cron (1685!), products, trending, etc
│   ├── filters/                # rankFields, timeRange
│   ├── format.ts               # Formatação (moeda, números)
│   ├── hooks/                  # useSubscription
│   ├── hotmart/                # processor, sync, subscribers, api-client, etc
│   ├── lgpd/                   # erasure.ts
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── region.ts               # Região utils
│   ├── settings.ts             # DB settings read/write
│   ├── storage/saved.ts        # localStorage + hooks (321 linhas)
│   ├── types/                  # dto.ts, admin.ts, echotik.ts
│   └── usage/                  # consume, enforce, quota, period (4 módulos)
├── prisma/
│   ├── schema.prisma           # 20+ modelos, ~864 linhas
│   └── seed.ts                 # Seed script
├── __tests__/                  # 29 suites, 281 testes
├── middleware.ts                # Auth middleware (withAuth)
├── docs/                       # Documentação
├── vercel.json                 # 2 crons
└── types/next-auth.d.ts        # Type augmentation
```

### Integrações Externas

| Serviço  | Uso                                                          | Env Vars                                                                            |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Echotik  | API de dados TikTok (vídeos, produtos, creators, categorias) | `ECHOTIK_BASE_URL`, `ECHOTIK_USERNAME`, `ECHOTIK_PASSWORD`                          |
| Hotmart  | Pagamentos/assinaturas via webhooks                          | `HOTMART_TOKEN`, `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET`, `HOTMART_BASIC_AUTH` |
| Neon     | PostgreSQL serverless (prod/preview)                         | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`                                             |
| Vercel   | Deploy + crons                                               | `CRON_SECRET`, `NEXT_PUBLIC_ADMIN_MODE`, `NEXT_PUBLIC_APP_URL`                      |
| NextAuth | Autenticação JWT                                             | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`                                                   |

### Crons

| Rota                          | Horário          | Função                                           |
| ----------------------------- | ---------------- | ------------------------------------------------ |
| `/api/cron/echotik`           | 03:00 UTC diário | Ingestão de rankings, categorias, top lists      |
| `/api/cron/hotmart-reconcile` | 06:00 UTC diário | Retry de falhas, detecção de subs stale, limpeza |

---

## ETAPA 2 — Mapa Arquitetural

### 2.1 UI / Páginas

```
Landing (app/page.tsx) ──→ "use client" com ThemeProvider(theme.ts)
                           Conteúdo 100% estático + 1 fetch de planos

Login (app/login/page.tsx) ──→ "use client" com ThemeProvider(terceiro theme)
                                signIn("credentials") via NextAuth

App Shell (app/app/layout.tsx) ──→ "use client" com ThemeProvider(segundo theme)
                                    Sidebar fixa (260px) + drawer mobile
                                    SidebarQuota + AppTopHeader (region selector)
                                    SessionProvider via root layout

  ├─ /app/videos       → Rankings: fetch /api/trending/videos, VideoCardPro grid
  ├─ /app/products     → Rankings: fetch /api/trending/products, ProductCard grid
  ├─ /app/creators     → Rankings: fetch /api/trending/creators, CreatorTable
  ├─ /app/trends       → Novos: fetch /api/echotik/products/new, ProductTable
  ├─ /app/videos-salvos   → localStorage: useSavedVideos(), VideoCardPro grid
  ├─ /app/produtos-salvos → localStorage: useSavedProducts(), ProductCard grid
  ├─ /app/assinatura   → Hooks: useSubscription + useQuotaUsage
  ├─ /app/suporte      → Estático (email, link central ajuda)
  └─ /app/admin        → Admin: subscribers + metrics + quotas
```

### 2.2 API Routes (37 total)

**Admin (13 rotas):**

- Notifications: list, summary, update single, bulk patch
- Plans: CRUD
- Subscribers: list with filters
- Subscription metrics: aggregate stats
- Webhook events: list/inspect
- Users: list/manage
- Audit logs: paginated
- Quota usage/policy, settings, sync-hotmart, access-grants, erasure-requests

**Trending (3):** videos, products, creators — query Echotik data snapshots
**Echotik (4):** categories (L1/L2/L3), products/new
**User (5):** subscription, usage, me/profile, proxy/image, regions
**Cron (2):** echotik ingestion, hotmart reconciliation
**Auth (1):** NextAuth catch-all
**Webhooks (1):** Hotmart webhook receiver

### 2.3 Serviços (lib/)

```
lib/
├── access/resolver.ts     ← Cadeia de acesso runtime (subscription → grant → fallback)
├── usage/                 ← Sistema de quotas (4 módulos, transações atômicas)
│   ├── period.ts          ← Períodos mensais (upsert)
│   ├── quota.ts           ← Plano → limites
│   ├── enforce.ts         ← Pre-check de quota
│   └── consume.ts         ← Consumo idempotente (idempotencyKey)
├── hotmart/               ← Pipeline de webhooks
│   ├── processor.ts       ← Processador principal (upsert sub + notificações)
│   ├── sync.ts            ← Sync manual via API Hotmart
│   ├── subscribers.ts     ← Listagem de assinantes
│   └── api-client.ts      ← HTTP client Hotmart
├── echotik/               ← Pipeline de ingestão
│   ├── client.ts          ← HTTP client com retry (3x, backoff exponencial)
│   ├── cron.ts            ← Orquestrador de ingestão (1685 linhas!)
│   ├── trending.ts        ← Utilitários de ranking/ciclo
│   └── products.ts        ← Serviço de produtos novos
├── admin/notifications.ts ← Sistema de notificações (8 regras, dedup 1h)
├── auth.ts                ← Config NextAuth (JWT, credentials, dev bypass)
├── prisma.ts              ← Singleton PrismaClient
├── categories.ts          ← Cache in-memory de categorias (10min TTL)
├── settings.ts            ← CRUD de Settings no DB
└── storage/saved.ts       ← LocalStorage + cross-tab sync + React hooks
```

### 2.4 Autenticação & Autorização

```
Fluxo:
  Request
    → middleware.ts (withAuth)
      → /app/* e /api/admin/* precisam JWT válido
      → /api/admin/* precisa role=ADMIN
      → soft-deleted bloqueados
    → Route handler
      → requireAdmin() / isAuthed() guards
      → resolveUserAccess() para features de quota
```

### 2.5 Modelos de Dados (Prisma)

**Core:** User, Subscription, Plan, PlanExternalMapping  
**Hotmart:** HotmartSubscription, HotmartWebhookEvent, ExternalAccountLink  
**Acesso:** AccessGrant  
**Usage:** UsagePeriod, UsageEvent  
**Admin:** AdminNotification, AuditLog, Setting  
**Echotik:** EchotikRawResponse, IngestionRun, VideoSnapshot, ProductSnapshot, CreatorSnapshot, ShopCategory  
**LGPD:** ErasureRequest  
**Billing:** SubscriptionCharge  
**Regions:** Region

---

## ETAPA 3 — Diagnóstico de Organização

### 🔴 CRÍTICO

| #   | Problema                                     | Onde                                                             | Impacto                                                                                              |
| --- | -------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| C1  | **Landing page = 3.592 linhas "use client"** | `app/page.tsx`                                                   | Zero SSR/SSG numa página que é 99% estática. Bundle JS enorme no first load. SEO prejudicado.        |
| C2  | **3 definições de MUI theme diferentes**     | `app/theme.ts`, `app/app/layout.tsx:42`, `app/login/page.tsx:21` | Cores e espaçamentos inconsistentes entre landing, app e login. Manutenção duplicada.                |
| C3  | **`getUserActivePlan` ignora AccessGrant**   | `lib/usage/quota.ts`                                             | Usuário com grant manual mas sem subscription → quotas = zero → todas features bloqueadas. Bug real. |
| C4  | **`cron.ts` = 1.685 linhas**                 | `lib/echotik/cron.ts`                                            | Módulo monolítico, impossível testar/manter por partes                                               |
| C5  | **Dupla lógica de extractQuotas**            | `lib/access/resolver.ts` + `lib/usage/quota.ts`                  | Risco de divergência — duas implementações plan→quotas que podem ficar dessincronizadas              |

### 🟠 IMPORTANTE

| #   | Problema                                   | Onde                                                           | Impacto                                                                                  |
| --- | ------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| I1  | **2 VideoCard duplicados**                 | `VideoCardPro.tsx` (797 linhas) + `VideoCard.tsx` (611 linhas) | ~1400 linhas de código quase idêntico, manutenção duplicada                              |
| I2  | **Admin dashboard monolítico**             | `app/app/admin/page.tsx` (1016 linhas)                         | Sem componentização, difícil adicionar features                                          |
| I3  | **Assinatura page monolítica**             | `app/app/assinatura/page.tsx` (955 linhas)                     | Mesma situação do admin                                                                  |
| I4  | **Layout autenticado monolítico**          | `app/app/layout.tsx` (700 linhas)                              | Sidebar, theme, quota display tudo inline                                                |
| I5  | **Nenhuma lib de data fetching**           | Todas as pages                                                 | Sem cache, sem dedup, sem revalidação. Cada page faz fetch manual + useState + useEffect |
| I6  | **Paginação client-side**                  | videos, products, creators                                     | API retorna TUDO, frontend faz slice local. Não escala.                                  |
| I7  | **`categories.ts` self-fetch via HTTP**    | `lib/categories.ts`                                            | Servidor faz HTTP pra si mesmo ao invés de chamar DB direto                              |
| I8  | **Cache in-memory em serverless**          | `lib/categories.ts`                                            | `_categoriesCache` não sobrevive entre invocações Lambda — TTL 10min ineficaz            |
| I9  | **Prompt config salva só em localStorage** | admin page                                                     | Configuração de prompts não persiste no servidor — perdida ao trocar browser             |
| I10 | **Login page sem `next/font`**             | `app/layout.tsx`                                               | Inter carregada via Google Fonts link — perde otimização (self-hosting, subset, no CLS)  |

### 🟡 DESEJÁVEL

| #   | Problema                                          | Onde                      | Impacto                                                                  |
| --- | ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| D1  | **TranscriptDialog ≈ InsightDialog**              | `components/videos/`      | 80% clone — extrair CopyableDialog genérico                              |
| D2  | **videos/products/creators pages ~90% clone**     | `app/app/`                | Extrair TrendingListPage genérico                                        |
| D3  | **videos-salvos ≈ produtos-salvos**               | `app/app/`                | 95% clone — extrair SavedItemsPage genérico                              |
| D4  | **`UI` design tokens redefinidos em 6+ arquivos** | páginas e components      | Cada arquivo define um objeto `UI = { ... }` com valores quase idênticos |
| D5  | **`handleInsightClick` é noop**                   | videos page               | TODO não implementado                                                    |
| D6  | **`formatTimeAgo` duplicado**                     | VideoCardPro + assinatura | Mesmo helper em 2+ lugares                                               |
| D7  | **URL builder duplicado 5x**                      | videos page               | products page resolveu com `updateUrl` helper                            |
| D8  | **`availableRegions` set but unused**             | 3 pages                   | Estado setado no fetch mas nunca renderizado                             |
| D9  | **`useScrollState` dead code**                    | landing page              | Hook definido mas nunca chamado                                          |
| D10 | **`useQuotaUsage` em `lib/admin/`**               | hook                      | Nome sugere admin-only, mas é usado na assinatura do usuário             |
| D11 | **`confirm()` do browser**                        | saved pages               | Inconsistente com MUI Dialog pattern do resto do app                     |

### ⚪ COSMÉTICO

| #   | Problema                                                                      | Onde         |
| --- | ----------------------------------------------------------------------------- | ------------ |
| K1  | Coupons section no admin permanentemente desabilitada                         | admin page   |
| K2  | "Central de Ajuda" botão disabled sem previsão                                | suporte page |
| K3  | Modelagem de Criativo timeline duplicada (desktop + mobile = mesmos dados 2x) | landing page |
| K4  | `data/` dir vazio em `lib/`                                                   | lib/data/    |
| K5  | `scripts/` dir vazio                                                          | scripts/     |
| K6  | Sem README.md                                                                 | root         |
| K7  | Sem ESLint config file                                                        | root         |

---

## ETAPA 4 — Auditoria de Padrões e Convenções

### 4.1 Nomenclatura

| Aspecto                 | Padrão Atual                                   | Consistente? |
| ----------------------- | ---------------------------------------------- | ------------ |
| Arquivos de componente  | PascalCase (`.tsx`)                            | ✅ Sim       |
| Arquivos de lib/serviço | camelCase (`.ts`)                              | ✅ Sim       |
| Variáveis/funções       | camelCase                                      | ✅ Sim       |
| Types/Interfaces        | PascalCase com sufixo `DTO`                    | ✅ Sim       |
| API routes              | kebab-case dirs (`webhook-events`)             | ✅ Sim       |
| Enums Prisma            | UPPER_SNAKE                                    | ✅ Sim       |
| Pastas de página        | kebab-case (`videos-salvos`)                   | ✅ Sim       |
| Const objects           | UPPER_SNAKE (`PLANS_FALLBACK`, `NAV_SECTIONS`) | ✅ Sim       |

**Veredicto:** Nomenclatura é **consistente** em todo o projeto. ✅

### 4.2 Componentes

| Padrão                                                 | Estado                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| Todos `"use client"` no dashboard                      | ✅ Consistente (35 arquivos)                               |
| Zero RSC (React Server Components) na área autenticada | ⚠️ Perda de performance, mas consistente                   |
| Um componente por arquivo                              | ❌ Landing page tem 12 inline, VideoCardPro faz de tudo    |
| Props tipadas                                          | ✅ Todas interfaces definidas                              |
| Forwarding de ref                                      | ❌ Nenhum `forwardRef` encontrado (não necessário por ora) |
| Memoização                                             | ❌ Zero `React.memo`, `useMemo` em computações pesadas     |

### 4.3 Hooks

| Padrão                     | Estado                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Custom hooks               | 3 hooks: `useSubscription`, `useQuotaUsage`, `useSavedVideos/Products`                                         |
| Hooks em `lib/hooks/`      | ❌ Parcial — `useSubscription` em `lib/hooks/`, `useQuotaUsage` em `lib/admin/`, saved hooks em `lib/storage/` |
| Naming `use*`              | ✅ Consistente                                                                                                 |
| Dependency arrays corretos | ⚠️ Trends page tem potencial double-fetch por deps de useCallback                                              |

### 4.4 Chamadas de API (Frontend)

| Padrão           | Estado                                                          |
| ---------------- | --------------------------------------------------------------- |
| `fetch()` nativo | ✅ 100% — zero SWR/React Query                                  |
| AbortController  | ⚠️ Parcial — videos/products/creators usam, trends não          |
| Error handling   | ⚠️ Básico — try/catch com estado `error`, sem retry client-side |
| Loading states   | ✅ Skeleton no VideoCardPro, loading boolean nas pages          |
| Caching          | ❌ Nenhum — toda navegação refetch do zero                      |
| Admin client     | ✅ `lib/admin/admin-client.ts` centraliza calls do admin        |

### 4.5 Tratamento de Erros

| Camada            | Padrão                                                            |
| ----------------- | ----------------------------------------------------------------- |
| API routes        | try/catch → NextResponse.json({ error }, { status })              |
| Webhooks          | try/catch → log + notificação + status 200 (para não re-entregar) |
| Echotik client    | Retry com backoff + detecção de rate limit                        |
| Hotmart processor | `withRetry` wrapper + notification on failure                     |
| Frontend          | try/catch → `setError(msg)` → UI red alert                        |
| Global error      | `app/global-error.tsx` exists                                     |

**Veredicto:** Backend tem error handling sólido. Frontend é básico mas funcional. ✅

### 4.6 Types

| Aspecto                | Estado                                                     |
| ---------------------- | ---------------------------------------------------------- |
| DTOs centralizados     | ✅ `lib/types/dto.ts` — VideoDTO, ProductDTO, CreatorDTO   |
| Admin types            | ✅ `lib/types/admin.ts` — Subscriber, Metrics, QuotaPolicy |
| NextAuth augmentation  | ✅ `types/next-auth.d.ts`                                  |
| Prisma generated types | ✅ Importados diretamente                                  |
| `any` usage            | ⚠️ Presente em alguns route handlers para request bodies   |
| Strict mode            | ✅ `tsconfig.json` com `strict: true`                      |

### 4.7 Estilização

| Aspecto             | Estado                                                               |
| ------------------- | -------------------------------------------------------------------- |
| Abordagem principal | MUI `sx` prop (95%+)                                                 |
| CSS Modules         | ❌ Zero usage                                                        |
| Tailwind            | ❌ Não instalado                                                     |
| Design tokens       | ❌ Objeto `UI` redefinido em 6+ arquivos com valores quase idênticos |
| Theme customization | ⚠️ 3 themes diferentes (landing, app, login)                         |
| Responsividade      | ✅ Breakpoints MUI consistentes, mobile drawer, layouts adaptivos    |
| Dark mode           | ✅ Dark-only (não há light mode)                                     |

### 4.8 Auth & Guards

| Padrão                                    | Usado em                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| `middleware.ts` route matching            | `/app/*`, `/api/admin/*`                                 |
| `requireAdmin()` em API routes            | Todas rotas `/api/admin/*`                               |
| `isAuthed()` em API routes                | Rotas de usuário                                         |
| `getServerSession()` para dados de sessão | Route handlers                                           |
| Role check no client                      | Admin page faz redirect client-side se non-admin         |
| Dev bypass                                | `__DEV_BYPASS__` password + `NEXT_PUBLIC_ADMIN_MODE` env |

### 4.9 Logs & Observabilidade

| Aspecto                      | Estado                                                |
| ---------------------------- | ----------------------------------------------------- |
| Console.log                  | ✅ Usado para eventos significativos (webhooks, cron) |
| AuditLog model               | ✅ Persiste ações admin no banco                      |
| AdminNotification            | ✅ 8 regras automáticas com dedup                     |
| Error tracking (Sentry, etc) | ❌ Não configurado                                    |
| Structured logging           | ❌ console.log/error plain text                       |
| Request tracing              | ❌ Sem correlation IDs                                |

### 4.10 Testes

| Aspecto               | Estado                                                        |
| --------------------- | ------------------------------------------------------------- |
| Framework             | Vitest 4.1.0 com globals                                      |
| Cobertura             | V8, thresholds por módulo (auth 90%, resolver 90%, usage 80%) |
| Mock pattern          | `prismaMock` de `@tests/helpers/prisma-mock`                  |
| Total                 | 29 suites, 281 testes, todos passando                         |
| Testes de API routes  | ✅ Sim                                                        |
| Testes de services    | ✅ Sim                                                        |
| Testes de componentes | ❌ Zero (sem React Testing Library)                           |
| Testes E2E            | ❌ Zero (sem Playwright/Cypress)                              |
| CI/CD pipeline        | ❌ Sem GitHub Actions configurado                             |

---

## ETAPA 5 — Draft Copilot Instructions (Produto-Específico)

Abaixo está o draft expandido para substituir o `.github/copilot-instructions.md` atual.

```markdown
# Copilot Instructions — Hyppado

## Produto

Hyppado é um SaaS de inteligência para TikTok Shop. Usuários assinam via Hotmart
para acessar rankings de vídeos, produtos e creators. Dados vindos da API Echotik.

## Git Workflow

- Sempre commitar na branch `develop`.
- Para levar mudanças para produção: abrir PR de `develop` → `main` e fazer merge.
- Nunca fazer push direto em `main`, a não ser hotfix crítico.
- Commits seguem conventional commits: `feat:`, `fix:`, `security:`, `refactor:`, `test:`, `chore:`.

## Stack

- Next.js 14 (App Router), Prisma 5, PostgreSQL (Neon em prod), Vitest, NextAuth 4
- Banco: apenas `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (direct/migrations)
- Deploy: Vercel (develop → preview em dev.hyppado.com, main → production em hyppado.com)
- UI: MUI v5, dark-only, sx prop pra estilização

## Código — Regras Obrigatórias

- Usar o singleton Prisma de `lib/prisma.ts` — NUNCA `new PrismaClient()` em arquivos de app.
- Rotas admin: `requireAdmin()` + `isAuthed()` guard em todo handler.
- Idioma do código: inglês (variáveis, funções, tipos). Comentários e mensagens UI: português.
- Toda rota de API deve ter try/catch com `NextResponse.json({ error }, { status })`.
- Novos arquivos de teste vão em `__tests__/` espelhando a estrutura de `lib/` ou `app/api/`.
- Testes usam `prismaMock` de `@tests/helpers/prisma-mock`.

## Arquitetura — Onde Colocar Coisas

- **Lógica de negócio**: `lib/<domínio>/` (ex: `lib/hotmart/`, `lib/usage/`, `lib/access/`)
- **API routes**: `app/api/<domínio>/route.ts` — thin handlers que chamam lib/
- **Componentes**: `app/components/<categoria>/` (cards, dashboard, filters, layout, ui, videos)
- **Tipos compartilhados**: `lib/types/dto.ts` (DTOs), `lib/types/admin.ts` (admin)
- **Hooks**: `lib/hooks/` (ou junto do módulo se muito específico)
- **Constantes/configs**: junto do módulo que usa (ex: `lib/filters/rankFields.ts`)

## Auth & Acesso

- Middleware protege `/app/*` e `/api/admin/*` via JWT.
- Cadeia de acesso (runtime, nunca persistida):
  1. User status (suspended/deleted → blocked)
  2. AccessGrant (admin override) → FULL_ACCESS
  3. Subscription ACTIVE → FULL_ACCESS
  4. Fallback → NO_ACCESS
- Quotas: `lib/usage/` — consumo idempotente com `idempotencyKey`.

## Integrações

- **Echotik**: client em `lib/echotik/client.ts`, Basic Auth, retry 3x.
  Cron de ingestão em `lib/echotik/cron.ts` (diário 03:00 UTC).
  Budget: 10k req/mês.
- **Hotmart**: webhooks em `/api/webhooks/hotmart/`, processador em `lib/hotmart/processor.ts`.
  Reconciliação diária em `/api/cron/hotmart-reconcile`.
  Notificações automáticas via `lib/admin/notifications.ts`.

## Padrões de Qualidade

- Testes: Vitest com cobertura V8. Thresholds: auth 90%, resolver 90%, usage 80%.
- Sem `any` em tipos de domínio — usar DTOs tipados.
- Sem `console.log` para debugging — use só para eventos de negócio significativos.
- Erros de API sempre retornam JSON com campo `error`.
- Webhooks sempre retornam 200 (mesmo com erro interno) para evitar re-entrega.

## Problemas Conhecidos (Não Replicar)

- NÃO criar mais objetos `UI = { ... }` com design tokens inline. Consolidar futuramente.
- NÃO criar mais definições de `createTheme()` — usar os existentes.
- NÃO criar componentes monolíticos com 500+ linhas.
- NÃO fazer fetch do próprio servidor via HTTP — chamar serviço direto.
- NÃO duplicar lógica plan→quotas — usar `lib/usage/quota.ts`.
```

---

## ETAPA 6 — Estrutura Proposta para Copilot Instructions

```
# Copilot Instructions — Hyppado

## Produto                    ← O que o Hyppado faz (2 linhas)
## Git Workflow               ← Branches, commits, deploy
## Stack                      ← Tecnologias e versões
## Código — Regras            ← Obrigatórias, sem exceção
## Arquitetura                ← Onde colocar coisas novas
## Auth & Acesso              ← Como funciona autenticação e autorização
## Integrações                ← Echotik, Hotmart, Neon
## Padrões de Qualidade       ← Testes, tipos, errors, logs
## Problemas Conhecidos       ← Anti-patterns a NÃO replicar
```

---

## ETAPA 7 — Entregáveis Finais

### Resumo Executivo

**Hyppado é um projeto bem arquitetado no backend** — acesso runtime-computed, quotas atômicas e idempotentes, webhooks com retry e notificação, 281 testes com thresholds por módulo. A stack é enxuta (12 deps runtime) e as escolhas técnicas são sólidas.

**O frontend carrega dívida técnica significativa**:

- 3 arquivos com 700-3600 linhas sem componentização
- 3 themes MUI divergentes
- Zero cache/dedup de dados (sem SWR/React Query)
- 2 VideoCards duplicados (~1400 linhas)
- Toda área autenticada é "use client" sem RSC
- Landing page deveria ser SSR/SSG mas é 100% client-rendered

### O que está BOM e não precisa mudar agora

1. ✅ `lib/usage/` — Sistema de quotas exemplar (4 módulos, atomic, idempotent)
2. ✅ `lib/access/resolver.ts` — Acesso runtime-computed, nunca stale
3. ✅ `lib/hotmart/processor.ts` — Pipeline robusto com retry + notifications
4. ✅ `lib/admin/notifications.ts` — 8 regras, dedup, severity levels
5. ✅ Prisma singleton + migrations workflow
6. ✅ 281 testes passando com coverage thresholds
7. ✅ Middleware + guards layered
8. ✅ Conventional commits + develop → main workflow
9. ✅ Nomenclatura consistente em todo projeto
10. ✅ CDN proxy pattern para evitar CORS/hotlink

### Prioridades de Refatoração (Ordem Sugerida)

| Prioridade | Ação                                                    | Esforço | Impacto                          |
| ---------- | ------------------------------------------------------- | ------- | -------------------------------- |
| 1          | **Fix C3** — `getUserActivePlan` considerar AccessGrant | Pequeno | Bug real em produção             |
| 2          | **Fix C5** — Unificar extractQuotas / getQuotaLimits    | Pequeno | Elimina risco de divergência     |
| 3          | **Fix C2** — Unificar os 3 MUI themes                   | Médio   | Consistência visual + manutenção |
| 4          | **Refactor I1** — Consolidar VideoCard + VideoCardPro   | Médio   | -1000 linhas                     |
| 5          | **Refactor I2+I3** — Split admin + assinatura pages     | Médio   | Manutenibilidade                 |
| 6          | **Add I5** — Adotar SWR ou React Query                  | Médio   | Cache, dedup, UX                 |
| 7          | **Fix I6** — Server-side pagination nas APIs trending   | Médio   | Escala                           |
| 8          | **Refactor C1** — Decompose landing page + SSR          | Grande  | SEO, performance, bundle size    |
| 9          | **Refactor C4** — Split cron.ts em módulos              | Médio   | Testabilidade                    |
| 10         | **Add testes** — Componentes (RTL) + E2E (Playwright)   | Grande  | Confiabilidade                   |

### Métricas do Projeto

| Métrica                        | Valor           |
| ------------------------------ | --------------- |
| Total de arquivos `.ts`/`.tsx` | ~100            |
| Linhas de código (estimado)    | ~20.000         |
| Modelos Prisma                 | 20+             |
| API routes                     | 37              |
| Componentes React              | 19              |
| Pages (autenticadas)           | 10              |
| Testes                         | 281 (29 suites) |
| Dependências runtime           | 12              |
| Crons                          | 2               |
| Env vars usadas                | ~12             |
