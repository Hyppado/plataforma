# Integrações

## Echotik (TikTok Shop)

### Visão geral

A Echotik é a fonte primária de dados do Hyppado. Todos os dados de vídeos, produtos e creators vêm da API Echotik, ingeridos pelo cron e armazenados no banco. **Nenhuma rota voltada ao usuário chama a API Echotik diretamente.**

### Arquivos principais

| Arquivo                                 | Responsabilidade                                      |
| --------------------------------------- | ----------------------------------------------------- |
| `lib/echotik/client.ts`                 | HTTP client (`echotikRequest`)                        |
| `lib/echotik/cron/orchestrator.ts`      | `detectNextTask()` — determina próxima tarefa do cron |
| `lib/echotik/cron/syncVideos.ts`        | Ingestão de vídeos por região                         |
| `lib/echotik/cron/syncProducts.ts`      | Ingestão de produtos por região                       |
| `lib/echotik/cron/syncCreators.ts`      | Ingestão de creators por região                       |
| `lib/echotik/cron/syncCategories.ts`    | Ingestão de categorias                                |
| `lib/echotik/cron/uploadImages.ts`      | Upload de imagens para Vercel Blob                    |
| `lib/echotik/cron/cacheDownloadUrls.ts` | Cache de URLs de download de vídeo                    |
| `lib/echotik/cron/cleanupOrphans.ts`    | Limpeza de blobs e linhas órfãs                       |
| `app/api/cron/echotik/route.ts`         | Endpoint do cron (aceita `?task=&region=&force=`)     |

### Fluxo de ingestão

```
Vercel Cron → GET /api/cron/echotik
                    ↓
             detectNextTask()
               ↓ retorna { task, region }
   syncVideoRanklist(runId, region)
   syncProductRanklist(runId, region)
   syncCreatorRanklist(runId, region)
   uploadPendingImages()
   cachePendingDownloadUrls()
   cleanupOrphanedBlobs()
```

Cada invocação processa **uma tarefa** dentro do limite de 60s do Vercel. O orchestrator usa skip keys para garantir que cada tarefa seja processada uma vez por ciclo.

### Sequência de prioridade do orchestrator

1. Categorias (uma vez)
2. Vídeos — uma região por vez (BR, US, JP, ...)
3. Produtos — uma região por vez
4. Creators — uma região por vez
5. `upload-images` — une uploads pendentes
6. `cache-download-urls` — pré-busca URLs de download
7. `cleanup-orphans` — uma vez por 24h

### Regra crítica

`echotikRequest` de `lib/echotik/client.ts` só pode ser chamado por:

- Módulos de ingestão em `lib/echotik/cron/`
- Cron de upload de imagens
- Cron de cache de download URLs
- Proxy de imagem `app/api/proxy/` (fallback deprecado)
- Transcrição `lib/transcription/media.ts` (fallback — quando URL cacheada não está disponível)

**Nunca** usar `echotikRequest` em rotas voltadas ao usuário.

### Imagens

Imagens são armazenadas no Vercel Blob (`@vercel/blob`). Rotas de trending servem `blobUrl`/`avatarBlobUrl` quando disponíveis, com fallback para o proxy.

### Regiões

Regiões vêm exclusivamente da tabela `Region` no banco. Nunca de variáveis de ambiente. Fallback para `["BR", "US", "JP"]` se o banco retornar vazio.

---

## Hotmart

### Visão geral

O Hotmart é a plataforma de pagamentos. O Hyppado recebe eventos via webhook e provisiona/cancela assinaturas automaticamente.

### Credenciais

Credenciais são armazenadas **exclusivamente no banco** (tabela `Setting`) com valores sensíveis criptografados (AES-256-GCM). São gerenciadas pelo painel admin em `CredentialsCard`.

Resolução via `getHotmartConfig()` em `lib/hotmart/config.ts` — sem fallback para variáveis de ambiente. Se qualquer credencial estiver ausente no banco, a operação falha com erro explícito.

**Chave de criptografia:** derivada do `NEXTAUTH_SECRET` via SHA-256 (32 bytes). Se `NEXTAUTH_SECRET` for trocado, os secrets no banco ficam ilegíveis — executar `node scripts/reencrypt-hotmart-secrets.mjs` para re-criptografar com a nova chave.

`getSecretSetting()` trata erros de descriptografia com try/catch — retorna `null` em vez de lançar exceção, permitindo que `getHotmartConfig()` produza uma mensagem de erro clara.

### Webhook

Endpoint: `POST /api/webhooks/hotmart`

**Validação:** token estático `X-Hotmart-Hottok` comparado com `timingSafeEqual`. Fail closed: se o secret não estiver configurado **no banco**, a requisição é rejeitada com 500.

**Idempotência:** dedup por `idempotencyKey` (SHA-256 determinístico). Eventos duplicados retornam 200 sem reprocessamento.

### PURCHASE_APPROVED — Provisionamento principal

Fluxo de provisionamento ao receber `PURCHASE_APPROVED`:

1. Resolve ou cria usuário + `ExternalAccountLink`
2. Reactiva usuário INACTIVE (SUSPENDED permanece para revisão admin)
3. Resolve plano via `getProvisioningPlan(fields)` — match por `planCode` → fallback para primeiro plano ativo
4. Upsert `Subscription` + `HotmartSubscription` com status ACTIVE
5. Upsert `SubscriptionCharge` com status PAID
6. Acesso é runtime-driven (`resolveAccess()`) — nenhum estado derivado persistido
7. Audit log: `WEBHOOK_PURCHASE_APPROVED` (primeira compra) ou `WEBHOOK_PURCHASE_RENEWED`
8. Notificação admin: `SUBSCRIPTION_ACTIVATED` (apenas primeira compra)
9. Email de onboarding: apenas nova conta, não renovação (`.catch()` protegido)

**Renovação:** `recurrenceNumber > 1` = renovação.

### SUBSCRIPTION_CANCELLATION — Cancelamento definitivo

Fluxo ao receber `SUBSCRIPTION_CANCELLATION`:

1. Resolve identidade via subscriber email/code (sem bloco `buyer`)
2. Resolve plano
3. Upsert subscription com status CANCELLED
4. Define `cancelledAt` e `endedAt` = data de cancelamento do evento
5. Usuário **não** é deletado nem suspenso — apenas o status da assinatura muda
6. Audit log: `WEBHOOK_SUBSCRIPTION_CANCELLATION`
7. Notificação admin: `SUBSCRIPTION_CANCELLATION` (severity: WARNING)

### Eventos de revogação imediata

Alguns eventos revogam o acesso imediatamente (sem período de graça), definindo `endedAt = occurredAt`:

- `PURCHASE_REFUNDED`
- `PURCHASE_CHARGEBACK`
- `SUBSCRIPTION_CANCELLATION` com motivo de cancelamento administrativo (`CANCELLED_BY_ADMIN`)

Os demais cancelamentos preservam `endedAt` original (fim do período pago).

### Planos e sincronização

`lib/hotmart/plans.ts` gerencia a sincronização:

- `listPlansForProduct()` — busca planos do produto na API Hotmart
- `syncPlansFromHotmart()` — cria/atualiza planos locais (quotas não são sobrescritas)
- `resolveOrSyncPlan(planCode)` — encontra plano local por `hotmartPlanCode`, sincroniza se não existir

**Regra:** Quotas (`transcriptQuota`, `scriptQuota`) são locais. Só alteradas pelo admin. Nunca sobrescritas pela sincronização.

**Produto configurado:** a sincronização usa o `HOTMART_PRODUCT_ID` salvo no banco para buscar o `ucode` do produto e listar apenas os planos desse produto. Planos de outros produtos nunca entram no banco.

---

## Email transacional (Resend)

### Visão geral

Emails são enviados via Resend. O cliente está em `lib/email/client.ts`.

- Remetente: `Hyppado <suporte@hyppado.com>`
- Reply-To: `suportehyppado@gmail.com`
- Sem `RESEND_API_KEY`: degrada graciosamente (retorna `{success: false}`)

### Templates

| Template                    | Uso                                        |
| --------------------------- | ------------------------------------------ |
| `buildOnboardingEmail`      | Novo usuário — link para criar senha (24h) |
| `buildPasswordResetEmail`   | Reset de senha — link para redefinir (1h)  |
| `buildWelcomePasswordEmail` | Senha temporária enviada por admin         |

Todos os templates usam `wrapTemplate()` para layout consistente. XSS-safe via `escapeHtml`.

### Tokens de setup/reset

`lib/email/setup-token.ts` gerencia tokens seguros:

- Geração: 32 bytes aleatórios, base64url → apenas o **hash SHA-256** é salvo no banco
- Expiração: 24h (onboarding), 1h (reset)
- Uso único: token é consumido (limpo) na primeira utilização
- Nunca há enumeração de email — resposta sempre genérica

### Pontos de disparo

| Evento                             | Email enviado            |
| ---------------------------------- | ------------------------ |
| `PURCHASE_APPROVED` (novo usuário) | Onboarding (criar senha) |
| Admin cria usuário (`sendEmail`)   | Onboarding (criar senha) |
| Admin reseta senha                 | Senha temporária         |
| Usuário solicita reset             | Reset de senha           |

---

## OpenAI

### Transcrição (Whisper)

`lib/transcription/whisper.ts` → OpenAI Whisper API.

Pipeline: URL Echotik cacheada → download do buffer → Whisper → verificação de alucinação → salva no banco.

Alucinação: outputs do tipo "apenas música" são detectados e rejeitados.

### Insight Hyppado

`lib/insight/generate.ts` → OpenAI Chat Completions com output estruturado.

Input: texto da transcrição + template de prompt (configurável pelo admin).

Output: `contexto`, `gancho`, `problema`, `solução`, `CTA`, `roteiro reutilizável`.

### Chave da API

Armazenada criptografada no banco via painel admin (OpenAITab). Nunca enviada ao browser. Resolução em runtime via `getSetting` / `getSecretSetting`.
