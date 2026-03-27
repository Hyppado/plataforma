# Copilot Instructions — Hyppado

## Produto

Hyppado é um SaaS de inteligência para TikTok Shop.
O produto ajuda usuários a encontrar vídeos, produtos e creators em alta, com recortes por região e período.
O acesso é autenticado e parte da experiência depende de assinatura/controle de acesso via Hotmart.

## Objetivo destas instruções

Estas instruções existem para manter consistência arquitetural, segurança, legibilidade e compatibilidade.
Antes de propor mudanças, entenda como o projeto já funciona hoje e preserve as decisões que já estão corretas.
Não introduza complexidade sem necessidade.

## Git Workflow

- Trabalhar na branch `develop`.
- Para produção, abrir PR de `develop` para `main`.
- Não fazer push direto em `main`, exceto hotfix crítico.
- Usar conventional commits:
  - `feat:`
  - `fix:`
  - `security:`
  - `refactor:`
  - `test:`
  - `chore:`

## Stack

- Next.js 14.1.0 com App Router
- MUI v5 (emotion/styled, dark-first)
- Prisma 5.22.0
- PostgreSQL com Neon em produção
- NextAuth 4.24.13
- SWR 2.4.1 (data fetching no cliente)
- Vitest 4.1.0 + Testing Library + Playwright 1.58.2
- Deploy na Vercel (funções com limite de 60s)
- Integrações principais: Echotik e Hotmart

## Estrutura atual do projeto

```
app/
  api/             → route handlers (finos — lógica vai para lib/)
    admin/         → rotas administrativas protegidas
    auth/          → NextAuth handlers
    cron/          → endpoints de cron (echotik, hotmart reconcile)
    echotik/       → endpoints de dados Echotik
    me/            → perfil do usuário autenticado
    proxy/         → proxy de imagens externas
    regions/       → CRUD de regiões ativas
    trending/      → dados trending
    usage/         → quotas do usuário
    user/          → dados do usuário
    webhooks/      → webhooks externos (Hotmart)
  components/
    BrandLogo.tsx  → componente de logo responsivo (usa next/image)
    admin/         → componentes da área admin
    cards/         → cards de vídeo, produto, creator, rank
    dashboard/     → componentes do dashboard autenticado
    filters/       → CategoryFilter, TimeRangeSelect etc.
    landing/       → componentes da landing page
    layout/        → layout compartilhado (sidebar, header)
    ui/            → primitivos reutilizáveis (Logo, etc.)
    videos/        → componentes específicos de vídeos
  dashboard/       → páginas autenticadas (/dashboard/*)
  login/           → página de login
  theme.ts         → MUI theme centralizado
lib/
  access/          → controle de acesso (AccessGrant, assinatura)
  admin/           → serviços administrativos
    admin-client.ts
    config.ts
    notifications.ts
    prompt-config.ts
    useQuotaUsage.ts
  auth.ts          → configuração NextAuth + callbacks
  categories.ts    → mapeamento de categorias
  echotik/
    client.ts      → HTTP client para API Echotik
    cron/          → módulos do cron de ingestão
      orchestrator.ts  → detectNextTask() → {task, region} | null
      helpers.ts       → getConfiguredRegions() lê tabela Region do DB
      syncVideos.ts    → syncVideoRanklist(runId, region, log)
      syncProducts.ts  → syncProductRanklist(runId, region, log)
      syncCreators.ts  → syncCreatorRanklist(runId, region, log)
      syncCategories.ts
      index.ts
      types.ts
    dates.ts / products.ts / rankFields.ts / trending.ts
  filters/         → utilitários de filtro compartilhados
  format.ts        → formatadores de número, data, moeda
  hotmart/
    client.ts / config.ts / oauth.ts
    processor.ts   → processamento de webhooks
    reconcile.ts   → reconciliação de assinaturas
    sync.ts / webhook.ts
  lgpd/            → consentimento e dados pessoais
  logger.ts        → createLogger(source, correlationId) → Logger estruturado
  prisma.ts        → singleton PrismaClient (SEMPRE usar este)
  region.ts        → helpers de região
  settings.ts      → configurações persistidas em banco
  storage/         → armazenamento de arquivos
  swr/
    fetcher.ts     → fetcher padrão para SWR
    useCategories.ts
    useTrending.ts
  types/
    admin.ts       → tipos da área admin
    dto.ts         → DTOs compartilhados
    echotik.ts     → tipos da API Echotik
  usage/           → lógica de quotas e limites por plano
prisma/
  schema.prisma    → schema Prisma (inclui modelo Region)
  seed.ts          → seed com regiões padrão BR, US, JP
__tests__/
  api/             → testes de route handlers
  components/      → testes RTL de componentes (jsdom)
    setup.tsx      → setup: jest-dom, mocks MUI/Next/auth
    CategoryFilter.test.tsx
    LoginPage.test.tsx
    Logo.test.tsx
    RankBadge.test.tsx
    TimeRangeSelect.test.tsx
    VideoCardSkeleton.test.tsx
  lib/             → testes de lógica de negócio
  middleware.test.ts
  security.test.ts
  setup.ts
e2e/
  smoke.spec.ts    → smoke tests: rotas públicas + redirect de auth
  login.spec.ts    → testes de interação do formulário de login
middleware.ts      → proteção de rotas /dashboard/* e /api/admin/*
playwright.config.ts
vitest.config.ts              → config node (testes de lib/api)
vitest.component.config.ts    → config jsdom (testes de componentes React)
.github/
  workflows/
    ci.yml         → CI: typecheck → unit+component → build → e2e-smoke
```

## Regras obrigatórias de código

- Usar sempre o singleton Prisma de `lib/prisma.ts`.
- Nunca criar `new PrismaClient()` em handlers, páginas ou serviços novos.
- Toda rota admin deve ter proteção server-side.
- Toda rota de API deve tratar erro com resposta JSON consistente.
- O idioma do código deve ser inglês: variáveis, funções, tipos, nomes internos.
- Texto de interface pode permanecer em português.
- Não usar `any` em tipos de domínio quando houver alternativa tipada.
- Preferir DTOs e tipos já existentes em `lib/types/`.

## Regras para API routes

- Route handlers devem ser finos.
- A lógica de negócio deve ir para `lib/<domínio>/`.
- API route não deve concentrar regra de negócio complexa.
- Sempre usar `try/catch`.
- Respostas de erro devem seguir padrão JSON com campo `error`.
- Não duplicar validação de regra de negócio na rota se ela já existir no serviço.

## Arquitetura — onde colocar cada coisa

- Lógica de negócio: `lib/<domínio>/`
- Integrações externas: dentro do domínio correspondente em `lib/`
- Route handlers: `app/api/<domínio>/`
- Componentes visuais: `app/components/<categoria>/`
- Hooks SWR compartilhados: `lib/swr/`
- Tipos compartilhados: `lib/types/dto.ts`, `lib/types/admin.ts`, `lib/types/echotik.ts`
- Configuração persistida em banco: `lib/settings.ts` e serviços correlatos

## Auth e acesso

### Regra global — nada é público

- **Toda rota em `app/api/**` exige autenticação server-side\*\*, sem exceção.
- O padrão obrigatório para rotas privadas é:
  ```ts
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth; // retorna 401
  ```
- Para rotas admin, usar `requireAdmin()` (retorna 401 se não autenticado, 403 se não for admin).
- Não confiar no middleware sozinho: toda rota deve ter guard interno.
- Não criar rota pública sem decisão formal e documentada.

### Exceções legítimas à autenticação por sessão

- **Webhooks externos** (ex: `/api/webhooks/hotmart`) — não usam sessão NextAuth.
  Devem ter validação própria forte de assinatura/origem (HMAC ou header oficial).
  Tratar todo input como não confiável. Aplicar idempotência.
- **Cron routes** (`/api/cron/*`) — autenticadas por `CRON_SECRET` no header `Authorization: Bearer`.
  Não aceitam sessão de usuário. Não expor para o browser.
- **NextAuth handler** (`/api/auth/[...nextauth]`) — gerenciado pelo NextAuth internamente.

### Helpers de auth (`lib/auth.ts`)

- `requireAuth()` — retorna `{ session, userId, role }` ou `NextResponse 401`
- `requireAdmin()` — retorna `{ session, userId, role }` ou `NextResponse 401/403`
- `isAuthed(result)` — type guard para distinguir sucesso de resposta de erro

### Middleware

- O middleware (`middleware.ts`) protege `/dashboard/*` e `/api/admin/*` a nível de roteamento.
- Para todas as outras rotas em `app/api/`, a autenticação é garantida pelo guard interno.
- Os dois mecanismos são complementares — não substituem um ao outro.

### Cadeia de acesso

1. status do usuário bloqueia acesso se suspenso/deletado
2. `AccessGrant` pode conceder override
3. assinatura ativa concede acesso
4. fallback sem acesso

- Não persistir estado derivado de acesso se ele puder ser resolvido corretamente em runtime.
- Não criar bypass novo de autorização fora do padrão existente.

## Quotas e uso

- Toda lógica de quotas deve passar por `lib/usage/`.
- Não duplicar lógica de plano para limites.
- Não reimplementar cálculo de quotas em componentes, páginas ou handlers.
- Consumo de quota deve continuar idempotente.
- Se precisar alterar limites por plano, centralizar no ponto correto do domínio de usage.

## Integração com Echotik — cron e ingestão

O cron foi refatorado para arquitetura modular e region-scoped para respeitar o limite de 60s da Vercel.

- **Client HTTP**: `lib/echotik/client.ts`
- **Orquestrador**: `lib/echotik/cron/orchestrator.ts`
  - `detectNextTask(force?)` → `{ task, region } | null`
  - Itera: categories → videos por região → products por região → creators por região → details
  - Chaves de skip no formato `echotik:videos:BR`, `echotik:products:US`, etc.
- **Sync functions**: cada uma recebe `(runId, region, log)` — uma região por invocação
  - `syncVideoRanklist(runId, region, log)` em `syncVideos.ts`
  - `syncProductRanklist(runId, region, log)` em `syncProducts.ts`
  - `syncCreatorRanklist(runId, region, log)` em `syncCreators.ts`
- **Regiões**: lidas exclusivamente da tabela `Region` do banco (`isActive=true`, `orderBy sortOrder`).
  Fallback `["BR", "US", "JP"]` se o banco retornar vazio.
  **Nunca usar variável de ambiente** para regiões.
- **Seed padrão**: `prisma/seed.ts` sobe BR, US, JP.
- Endpoint: `app/api/cron/echotik/route.ts` — aceita `?task=&region=&force=`
- Não misturar ingestão, transformação, persistência e observabilidade no mesmo bloco.
- Se adicionar comportamento novo, criar módulo separado em `lib/echotik/cron/`.

## Integração com Hotmart

- Webhooks: `/api/webhooks/hotmart` → `lib/hotmart/processor.ts`
- Reconciliação: cron dedicado → `lib/hotmart/reconcile.ts`
- Notificações administrativas: `lib/admin/notifications.ts`
- Novas mudanças devem preservar: retry, auditabilidade, separação recepção/processamento,
  compatibilidade com fluxo atual de assinaturas e reconciliação.

## Logs e observabilidade

- Usar `createLogger(source, correlationId)` de `lib/logger.ts` — retorna `Logger` estruturado.
- Nunca usar `console.log` como debugging solto.
- Registrar apenas eventos operacionais realmente significativos.
- Preservar auditabilidade das ações admin e eventos relevantes.
- Não vazar segredos, tokens ou payloads sensíveis nos logs.
- Em cron e integrações, passar o `logger` criado no início da invocação por toda a cadeia.

## Admin

- A área admin deve continuar protegida no servidor.
- Serviços em `lib/admin/`: `admin-client.ts`, `config.ts`, `notifications.ts`, `prompt-config.ts`, `useQuotaUsage.ts`.
- Não colocar segredo administrativo no frontend.
- Não usar `localStorage` ou `sessionStorage` para armazenar segredo ou credencial sensível.

## Frontend e componentes

- Não criar componente novo com centenas de linhas se ele puder ser dividido.
- Preferir componentização por responsabilidade (seção, card, tabela, diálogo, hook, helper).
- Extrair partes reutilizáveis quando houver duplicação real.
- Não deixar lógica de negócio complexa dentro de componente visual.
- **Logo**: usar `app/components/ui/Logo.tsx` (`Box component="img"`) para contextos simples
  ou `app/components/BrandLogo.tsx` (`next/image` com `fill`) para headers responsivos.
  Não criar novo componente de logo.

## Temas, design tokens e UI

- MUI com `sx` como abordagem principal.
- Theme centralizado em `app/theme.ts` — não criar novo `createTheme()`.
- Não criar objetos `UI = { ... }` espalhados com tokens inline.
- Manter coerência visual dark-first já existente.

## Data fetching no frontend

- O projeto usa **SWR** (`swr` 2.4.1) como padrão de data fetching no cliente.
- Hooks SWR ficam em `lib/swr/`: `fetcher.ts`, `useCategories.ts`, `useTrending.ts`.
- Não usar `useEffect` + `fetch` manual para novos dados — preferir SWR.
- Manter tratamento de erro e loading state.
- Não fazer fetch do próprio servidor via HTTP em contexto server-side; chamar o serviço diretamente.

## localStorage e persistência no cliente

- `localStorage` só pode ser usado para comportamento realmente local do usuário.
- Não usar para segredos, credenciais, configurações de sistema ou estado que precisa persistir no backend.
- Configuração de sistema ou admin deve persistir no servidor via `lib/settings.ts`.

## Testes

### Counts atuais (referência — março 2026)

- **407 testes unitários** (vitest, node env, `__tests__/lib/`, `__tests__/api/`, etc.)
- **46 testes de componentes** (vitest, jsdom env, `__tests__/components/`)
- **Total: 453 testes**, todos passando

### Configs de vitest

- `vitest.config.ts` — ambiente `node`, inclui `**/*.test.ts` (unitários)
- `vitest.component.config.ts` — ambiente `jsdom`, inclui `__tests__/components/**/*.test.{ts,tsx}`

### Scripts de teste

```
npm run test                → vitest run (node)
npm run test:components     → vitest run --config vitest.component.config.ts (jsdom)
npm run test:all            → test + test:components
npm run test:e2e            → playwright test
npm run test:e2e:ui         → playwright test --ui
npm run test:coverage       → vitest run --coverage
```

### Regras

- Novas mudanças em backend, auth, acesso, usage, Hotmart, admin e cron devem vir com testes.
- Novos testes unitários: `__tests__/` espelhando estrutura de `lib/` ou `app/api/`, usar `prismaMock`.
- Novos testes de componentes: `__tests__/components/`, importar setup via `vitest.component.config.ts`.
- Não criar teste decorativo; testar regra real.
- Se alterar regra de negócio crítica, atualizar ou criar teste antes de refatorar.

### Setup RTL (`__tests__/components/setup.tsx`)

Já configura: jest-dom matchers, mocks de `matchMedia`, `ResizeObserver`, `IntersectionObserver`,
`next/navigation`, `next/link`, `next/image` (com `priority → loading`), `next-auth/react`.

### E2E (Playwright)

- Specs em `e2e/`: `smoke.spec.ts` (rotas públicas + redirect de auth), `login.spec.ts` (formulário).
- Config em `playwright.config.ts`: usa `webServer` para subir `next dev` automaticamente com env vars dummy.
- Browsers instalados: Chromium. CI usa `workers: 1` e `retries: 2`.

## CI — GitHub Actions

Pipeline em `.github/workflows/ci.yml`, roda em push/PR para `develop` e `main`.

Jobs em ordem de dependência:

1. **typecheck** — `npx tsc --noEmit` + `prisma generate`
2. **unit-tests** — `npm run test` + `npm run test:components`
3. **build** — `npm run build`
4. **e2e-smoke** — `playwright test --project=chromium` (depende de build)

Artifacts de falha do Playwright são enviados para `e2e/.artifacts/` (retenção 7 dias).

## Segurança

- Não confiar em checagem apenas de frontend.
- Toda autorização relevante deve existir no servidor.
- Não expor secrets em código cliente.
- Validar entradas e payloads em rotas sensíveis.
- Em cron e integrações, falhar com segurança e registrar o suficiente para diagnóstico.
- Em webhooks, preservar comportamento atual para evitar reentrega indevida.

## Regras de organização

- Não deixar arquivo crescer sem controle.
- Não introduzir duplicação funcional.
- Não criar diretórios, helpers ou serviços cenográficos.
- Mudanças devem ser incrementais e seguras.
- Se encontrar código morto, só remover após validar impacto.

## Anti-patterns que não podem ser repetidos

- Não criar objetos inline de design tokens tipo `UI = { ... }`.
- Não criar novos themes divergentes.
- Não criar componentes monolíticos com 500+ linhas.
- Não duplicar lógica de quotas.
- Não fazer fetch do próprio servidor por HTTP em contexto server-side.
- Não deixar configuração importante só em `localStorage`.
- Não aumentar arquivos já monolíticos sem extrair responsabilidade antes.
- Não usar `ECHOTIK_REGIONS` env var — regiões vêm do banco.
- Não usar `console.log` — usar `createLogger`.
- Não chamar `new PrismaClient()` fora de `lib/prisma.ts`.
- Não usar `useEffect` + `fetch` manual para novos dados no cliente — usar SWR.

## Prioridades de manutenção ao mexer no projeto

1. segurança
2. compatibilidade funcional
3. regras de acesso e quotas
4. integridade de Hotmart/Echotik/cron
5. testes
6. organização e componentização
7. melhorias cosméticas

## Validação obrigatória antes de marcar tarefa como concluída

- Rodar `npm run build` e confirmar exit code 0.
- Rodar `npm run test:all` e confirmar que todos os 453 testes passam.
- Se o build ou os testes quebrarem, corrigir antes de commitar.
- Isso vale para qualquer mudança: refatoração, remoção de arquivos, nova feature, fix.

## Como responder mudanças neste projeto

Ao implementar algo:

1. entender como a área já funciona
2. apontar impacto
3. aplicar mudança mínima segura
4. sugerir refatoração maior só se necessário

Ao criar código:

- preferir solução simples
- preservar convenções existentes
- não reinventar fluxo já consolidado
- evitar abstração excessiva

## Quando refatorar

Refatorar quando houver duplicação real, risco de bug, acoplamento excessivo,
arquivo muito grande, baixa testabilidade ou regra duplicada em mais de um lugar.

Não refatorar só por estética se isso aumentar risco sem ganho real.

- Nothing in this project is public. There are no public API routes.
- Every route in `app/api/**` must require server-side authentication (session via NextAuth).
- The mandatory pattern is `requireAuth()` / `isAuthed()` from `lib/auth.ts`.
- Admin routes must use `requireAdmin()` — never just a frontend role check.
- Do not create anonymous API routes. Not even "temporarily".
- Do not rely on frontend checks for protected operations.
- Do not rely on middleware alone — every route must have an internal auth guard.
- The only valid exceptions are: webhooks (auth by HMAC/signature) and cron routes (auth by CRON_SECRET).
- Webhooks must validate payload origin with HMAC or official header — token-compare alone is not enough.
- Any new public-facing endpoint requires a formal, documented decision before creation.
