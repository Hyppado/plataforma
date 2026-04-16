# Hyppado

**Plataforma de inteligência de tendências para o TikTok Shop.**

Hyppado ajuda criadores de conteúdo, afiliados e vendedores a descobrir vídeos virais, produtos em alta e creators de destaque — com dados reais, filtros por região e análises geradas por IA.

---

## O que é o Hyppado

O Hyppado consome dados do TikTok Shop via API Echotik, armazena tudo em banco próprio e expõe uma interface limpa para assinantes. O acesso é controlado por assinatura via Hotmart.

**Funcionalidades principais:**

- 📈 Rankings de vídeos, produtos e creators por região e período
- 🔍 Filtros por categoria, tempo e mercado (BR, US, JP, outros)
- 💾 Salvar vídeos e produtos em coleções pessoais
- 📝 Transcrição automática de vídeos com Whisper (OpenAI)
- 🤖 Insight Hyppado — análise estruturada de vídeos via IA
- 🔔 Alertas e notas por item
- 🛡️ Painel administrativo completo com métricas, gestão de usuários e webhooks

---

## Stack

| Camada         | Tecnologia                            |
| -------------- | ------------------------------------- |
| Framework      | Next.js 14.1 (App Router)             |
| UI             | MUI v5 (Material UI, dark theme)      |
| Linguagem      | TypeScript 5                          |
| Banco de dados | PostgreSQL via Neon                   |
| ORM            | Prisma 5.22                           |
| Autenticação   | NextAuth 4.24                         |
| Data fetching  | SWR 2.4                               |
| Email          | Resend                                |
| Storage        | Vercel Blob                           |
| IA             | OpenAI (Chat Completions + Whisper)   |
| Deploy         | Vercel (Preview + Production)         |
| Testes         | Vitest + Testing Library + Playwright |

---

## Iniciando localmente

### Pré-requisitos

- Node.js 20+
- npm
- Banco PostgreSQL acessível (Neon recomendado)

### Configuração

```bash
# 1. Clone e instale dependências
git clone <repo>
cd hyppado
npm install

# 2. Crie o arquivo de variáveis de ambiente
cp .env.example .env
# → Edite .env com suas credenciais (veja a seção Variáveis de Ambiente)

# 3. Gere o Prisma Client e aplique migrações
npx prisma generate
npx prisma migrate deploy

# 4. Popule regiões padrão
npx prisma db seed

# 5. Crie um usuário admin
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/create-admin.ts

# 6. Inicie o servidor de desenvolvimento
npm run dev
```

O app estará rodando em `http://localhost:3000`.

### Variáveis de Ambiente

| Variável                 | Obrigatória | Descrição                                     |
| ------------------------ | :---------: | --------------------------------------------- |
| `DATABASE_URL`           |     ✅      | URL de conexão PostgreSQL (pooler)            |
| `DATABASE_URL_UNPOOLED`  |     ✅      | URL direta (usada pelo Prisma CLI/migrations) |
| `NEXTAUTH_SECRET`        |     ✅      | Secret para assinatura de sessões NextAuth    |
| `NEXTAUTH_URL`           |     ✅      | URL base da aplicação                         |
| `ECHOTIK_USERNAME`       |     ✅      | Credencial da API Echotik                     |
| `ECHOTIK_PASSWORD`       |     ✅      | Credencial da API Echotik                     |
| `ECHOTIK_BASE_URL`       |     ✅      | URL base da API Echotik                       |
| `CRON_SECRET`            |     ✅      | Secret para autenticar chamadas de cron       |
| `RESEND_API_KEY`         |     ✅      | API key do Resend (email transacional)        |
| `BLOB_READ_WRITE_TOKEN`  |     ✅      | Token do Vercel Blob (imagens)                |
| `HOTMART_WEBHOOK_SECRET` | Condicional | Secret de validação do webhook Hotmart        |
| `OPENAI_API_KEY`         | Condicional | Configurado via painel admin (não via .env)   |

> Credenciais Hotmart (client ID, client secret, basic token, webhook secret) são configuradas pelo painel admin e armazenadas criptografadas no banco — não precisam necessariamente estar no `.env`.

---

## Scripts disponíveis

```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Build de produção
npm run start            # Inicia build de produção
npm run test             # Testes unitários (Vitest, node env)
npm run test:components  # Testes de componentes (Vitest, jsdom)
npm run test:all         # Todos os testes unitários + componentes
npm run test:e2e         # Testes end-to-end (Playwright)
npm run test:coverage    # Cobertura de testes
npm run db:migrate       # Cria e aplica nova migração (dev)
npm run db:deploy        # Aplica migrações pendentes (prod)
npm run db:status        # Status das migrações
npm run db:generate      # Regenera o Prisma Client
```

---

## Estrutura de pastas

```
app/
  api/             → Route handlers (lógica em lib/)
    admin/         → Rotas administrativas protegidas
    auth/          → NextAuth + reset/setup de senha
    cron/          → Endpoints de cron (echotik, transcribe)
    insights/      → Insight Hyppado
    transcripts/   → Transcrição de vídeos
    trending/      → Dados de tendências
    webhooks/      → Webhooks externos (Hotmart)
    ...
  components/      → Componentes React
    admin/         → UI do painel admin
    cards/         → Cards de vídeo, produto, creator
    dashboard/     → Componentes do dashboard autenticado
    landing/       → Componentes da landing page
    layout/        → Sidebar, header
    videos/        → Diálogos de transcrição e insight
  dashboard/       → Páginas autenticadas
  login/           → Página de login
  criar-senha/     → Criação/reset de senha (token)
  recuperar/       → Solicitação de reset de senha
  theme.ts         → Tema MUI centralizado

lib/
  access/          → Controle de acesso e resolver de permissões
  admin/           → Serviços administrativos
  auth.ts          → Configuração NextAuth + helpers requireAuth/requireAdmin
  crypto.ts        → Criptografia AES-256-GCM para settings sensíveis
  echotik/         → Cliente HTTP + cron de ingestão Echotik
  email/           → Email transacional (Resend)
  hotmart/         → Integração Hotmart (webhooks, planos, OAuth)
  insight/         → Sistema de Insight Hyppado (IA)
  lgpd/            → LGPD: consentimento e exclusão de dados
  prisma.ts        → Singleton do PrismaClient
  settings.ts      → Configurações dinâmicas via banco de dados
  storage/         → Vercel Blob (imagens, avatars)
  swr/             → Hooks SWR para client-side fetching
  transcription/   → Sistema de transcrição (Whisper)
  types/           → DTOs e tipos compartilhados
  usage/           → Quotas e controle de uso

prisma/
  schema.prisma    → Schema do banco de dados
  migrations/      → Histórico de migrações SQL

__tests__/         → Testes unitários e de componentes
e2e/               → Testes end-to-end Playwright
.github/workflows/ → CI (ci.yml) + Auto-deploy (auto-deploy.yml)
```

---

## Fluxo de dados

```
Echotik API → Cron (/api/cron/echotik) → Banco de dados (Neon/PostgreSQL)
                                               ↓
                            Rotas autenticadas (/api/trending/*)
                                               ↓
                              Dashboard do usuário (SWR)
```

O cron roda no Vercel com limite de 60 segundos por execução. Cada chamada processa uma tarefa por vez (vídeos de uma região, produtos, creators, upload de imagens, etc.), orquestrada por `lib/echotik/cron/orchestrator.ts`.

---

## Autenticação e acesso

O acesso ao dashboard requer:

1. Conta de usuário ativa
2. Assinatura ativa **ou** AccessGrant administrativo

O provisionamento de acesso ocorre automaticamente via webhook `PURCHASE_APPROVED` do Hotmart. Administradores podem conceder acesso manual via painel.

Veja mais em [docs/autenticacao.md](docs/autenticacao.md).

---

## Deploy

- `develop` → ambiente **Preview** no Vercel
- `main` → ambiente **Production** no Vercel

O GitHub Action `auto-deploy.yml` avança `main` até `develop` automaticamente após CI passar. Migrações de banco são aplicadas automaticamente no deploy via `prisma migrate deploy`.

Veja mais em [docs/deploy.md](docs/deploy.md).

---

## Documentação

| Documento                                        | Conteúdo                           |
| ------------------------------------------------ | ---------------------------------- |
| [docs/visao-geral.md](docs/visao-geral.md)       | Produto, personas e casos de uso   |
| [docs/arquitetura.md](docs/arquitetura.md)       | Arquitetura, camadas e convenções  |
| [docs/banco-de-dados.md](docs/banco-de-dados.md) | Schema do banco, modelos e enums   |
| [docs/integracoes.md](docs/integracoes.md)       | Hotmart, Echotik e email           |
| [docs/autenticacao.md](docs/autenticacao.md)     | Autenticação, acesso e quotas      |
| [docs/deploy.md](docs/deploy.md)                 | CI/CD, Vercel e migrações de banco |

---

## Testes

O projeto mantém cobertura com **Vitest** (unitários + componentes) e **Playwright** (e2e).

```bash
npm run test:all   # Roda todos os testes unitários e de componentes
npm run test:e2e   # Roda os smoke tests end-to-end
```

Todo PR para `develop` passa por CI completo: typecheck → testes → build → e2e. Nenhum código com erros de tipo, falha de teste ou build quebrado deve ser commitado.

---

## Licença

Propriedade de Hyppado. Uso restrito.
