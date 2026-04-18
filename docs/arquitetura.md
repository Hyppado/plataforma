# Arquitetura

## Visão geral das camadas

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + MUI + SWR)                                │
├─────────────────────────────────────────────────────────────┤
│  Next.js App Router (SSR + Route Handlers)                  │
│    app/api/**        → Route handlers (thin)                │
│    app/dashboard/**  → Páginas autenticadas                 │
│    app/page.tsx      → Landing page pública                 │
├─────────────────────────────────────────────────────────────┤
│  lib/**              → Lógica de negócio                    │
│    lib/admin/        → Serviços admin (config, quotas)      │
│      config.ts       → DB read/write (server-only)          │
│      config-defaults.ts → Constantes client-safe            │
│    lib/echotik/      → Ingestão de dados TikTok Shop        │
│    lib/hotmart/      → Integração de pagamentos             │
│    lib/insight/      → Geração de insight por IA            │
│    lib/transcription/→ Transcrição por IA (Whisper)         │
│    lib/auth.ts       → Autenticação e autorização           │
│    lib/usage/        → Quotas e controle de uso             │
├─────────────────────────────────────────────────────────────┤
│  Prisma ORM → PostgreSQL (Neon)                             │
├─────────────────────────────────────────────────────────────┤
│  Serviços externos                                          │
│    Echotik API  → fonte de dados TikTok Shop                │
│    Hotmart      → pagamentos e webhooks                     │
│    OpenAI       → Whisper (transcrição) + Chat (insight)    │
│    Resend       → email transacional                        │
│    Vercel Blob  → armazenamento de imagens                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Estrutura de pastas

### `app/` — camada de apresentação

```
app/
  api/
    admin/           → 15 sub-rotas administrativas
      access-grants/
      audit-logs/
      echotik/         → config e health da Echotik
      erasure-requests/
      hotmart/
        credentials/   → credenciais Hotmart (GET/PUT)
        plans/         → sincronização de planos
        product/       → ID do produto Hotmart
      notifications/
      plans/
      prompt-config/
      quota-policy/
      quota-usage/
      settings/
      subscribers/
      subscription-metrics/
      users/
      webhook-events/
    auth/
      reset-password/  → solicitação de reset (público)
      setup-password/  → validação de token + criação de senha (público)
    cron/
      echotik/         → ingestão de dados Echotik
      transcribe/      → retry de transcrições com falha
    insights/          → Insight Hyppado (POST + GET [videoExternalId])
    me/                → perfil e dados do usuário autenticado
    proxy/             → proxy de imagem externo (fallback)
    regions/           → regiões ativas
    transcripts/       → transcrição sob demanda
    trending/          → dados de tendências (vídeos, produtos, creators)
      products/[id]/   → detalhes de produto (lê EchotikProductDetail + trend diário)
    usage/             → quotas do usuário
    webhooks/
      hotmart/         → webhook de eventos Hotmart
  components/
    BrandLogo.tsx      → logo responsivo (next/image)
    admin/             → componentes do painel admin
    cards/             → VideoCard, ProductCard, CreatorCard, RankCard, ProductDetailsModal
    dashboard/
      ForcePasswordChange.tsx → modal de troca de senha obrigatória
      PasswordChangeGuard.tsx → guarda de sessão para troca de senha
    filters/           → CategoryFilter, TimeRangeSelect
    landing/           → seções da landing page
    layout/            → sidebar, header
    ui/                → Logo, primitivos
    videos/            → TranscriptDialog, InsightDialog
  dashboard/           → páginas autenticadas (/dashboard/*)
  login/               → página de login
  criar-senha/         → criação/reset de senha por token
  recuperar/           → solicitação de reset por email
  theme.ts             → tema MUI centralizado (dark-first)
```

### `lib/` — lógica de negócio

```
lib/
  access/
    resolver.ts        → resolveAccess() — cadeia de acesso em runtime
  admin/
    admin-client.ts
    config.ts          → config de quotas e prompt templates
    notifications.ts   → criação e dedup de notificações admin
  auth.ts              → NextAuth config + requireAuth/requireAdmin/isAuthed
  categories.ts        → mapeamento de categorias
  crypto.ts            → AES-256-GCM encrypt/decrypt para settings
  echotik/
    client.ts          → HTTP client da API Echotik
    cron/
      orchestrator.ts  → detectNextTask() — determina próxima tarefa
      syncVideos.ts    → ingestão de vídeos por região
      syncProducts.ts  → ingestão de produtos por região
      syncCreators.ts  → ingestão de creators por região
      syncCategories.ts
      uploadImages.ts  → upload de imagens para Vercel Blob
      cacheDownloadUrls.ts → cache de URLs de download de vídeo
      cleanupOrphans.ts → limpeza de blobs e linhas órfãs
  email/
    client.ts          → Resend + sendEmail()
    templates.ts       → templates HTML de email
    setup-token.ts     → geração/validação/consumo de tokens de setup
    onboarding.ts      → orquestrador de email de onboarding
    password-reset.ts  → orquestrador de reset de senha
  format.ts            → formatadores de número, data, moeda
  hotmart/
    client.ts          → HTTP client Hotmart
    config.ts          → getHotmartConfig() — credenciais DB + env
    oauth.ts           → OAuth Hotmart
    plans.ts           → sincronização de planos
    processor.ts       → processamento de eventos webhook
    webhook.ts         → validação de assinatura + extração de campos
  insight/
    service.ts         → requestInsight / getInsight
    generate.ts        → OpenAI Chat Completions + parseInsightResponse
  lgpd/
    erasure.ts         → solicitações de exclusão de dados
  logger.ts            → createLogger(source, correlationId)
  prisma.ts            → singleton PrismaClient (SEMPRE usar este)
  region.ts            → helpers de região
  settings.ts          → configurações dinâmicas no banco
  storage/
    blob.ts            → Vercel Blob helpers
    saved.ts           → itens salvos
  swr/
    fetcher.ts         → SWR fetcher padrão
    useCategories.ts
    useTrending.ts
  transcription/
    service.ts         → requestTranscript / getTranscript
    media.ts           → download de vídeo via Echotik
    whisper.ts         → transcrição via OpenAI Whisper
  types/
    dto.ts             → DTOs compartilhados
    admin.ts           → tipos da área admin
    echotik.ts         → tipos da API Echotik
    echotik-admin.ts   → tipos admin Echotik
  usage/
    consume.ts         → consumeUsage()
    enforce.ts         → enforceQuota()
    period.ts          → gestão de períodos
    quota.ts           → resolução de quota
```

---

## Convenções de código

### Onde cada coisa vai

| O quê                         | Onde                          |
| ----------------------------- | ----------------------------- |
| Lógica de negócio             | `lib/<domínio>/`              |
| Integrações externas          | `lib/<domínio>/`              |
| Route handlers (thin)         | `app/api/<domínio>/`          |
| Componentes visuais           | `app/components/<categoria>/` |
| Hooks SWR                     | `lib/swr/`                    |
| Tipos e DTOs compartilhados   | `lib/types/`                  |
| Configuração dinâmica (banco) | `lib/settings.ts`             |
| Configuração de tema          | `app/theme.ts`                |

### Regras gerais

- Route handlers devem ser **thin** — lógica vai para `lib/`
- Sempre `try/catch` em routes, retorno JSON com campo `error`
- Imports em route handlers: sempre `@/` (nunca paths relativos longos)
- Nunca `new PrismaClient()` fora de `lib/prisma.ts`
- Nunca `console.log` — usar `createLogger` de `lib/logger.ts`
- Tipo `any` apenas quando não há alternativa tipada
- Data fetching client-side: sempre SWR, nunca `useEffect` + `fetch`

### Nomenclatura

- Componentes: `PascalCase`
- Hooks: prefixo `use`
- DTOs: sufixo `DTO`
- Route handlers: `app/api/{domínio}/{recurso}/route.ts`
- Imports: alias `@/`

---

## Frontend e componentes

### Tema

O tema MUI é centralizado em `app/theme.ts`. Nunca criar um novo `createTheme()`.

**Paleta principal:**

| Token             | Hex       | Uso                                         |
| ----------------- | --------- | ------------------------------------------- |
| `primary.main`    | `#2DD4FF` | Cor da marca (ciano), links, estados ativos |
| `primary.light`   | `#6BE0FF` | Variante mais clara                         |
| `primary.dark`    | `#00B8E6` | Variante mais escura                        |
| `secondary.main`  | `#FF2D78` | Destaque rosa — títulos de dialog, botões   |
| `secondary.light` | `#FF5C9A` | Variante rosa clara                         |
| `secondary.dark`  | `#E0256A` | Rosa mais escuro — hover states             |

Sempre referenciar cores via tokens (`"primary.main"`, `"secondary.main"`) em props `sx`. Nunca hardcodar hex que já estão na paleta.

### Logo

- **`app/components/ui/Logo.tsx`** — contextos simples (`Box component="img"`)
- **`app/components/BrandLogo.tsx`** — headers responsivos (`next/image` com `fill`)

Não criar novos componentes de logo.

### Landing page

- **`SectionShell`** — envolve todas as seções. Para fundos full-bleed (vídeos, imagens, overlays), passar via prop `backgroundSlot` — nunca como filhos comuns.
- **`HeroSection`** — passa `HeroBackgroundVideo` e `HeroOverlays` via `backgroundSlot`.
- Botões "Quero acesso agora" fazem scroll para `#planos` com comportamento smooth.
- "Assinar" no login leva para `/#planos`.

---

## Monitoramento e logs

- Usar `createLogger(source, correlationId)` de `lib/logger.ts`
- Nunca usar `console.log` para debug
- Logar apenas eventos operacionais relevantes
- Nunca vazar secrets, tokens ou payloads sensíveis em logs
- Em cron e integrações, passar o logger ao longo de toda a cadeia de chamadas
