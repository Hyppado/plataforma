# Banco de Dados

O banco de dados é PostgreSQL hospedado no **Neon**. O ORM é **Prisma 5.22** com o schema em `prisma/schema.prisma`.

---

## Modelos por domínio

### Domínio 1 — Identidade e IAM

#### `User`

Identidade central do sistema.

| Campo                 | Tipo          | Descrição                                     |
| --------------------- | ------------- | --------------------------------------------- |
| `id`                  | String (CUID) | PK                                            |
| `email`               | String        | Único                                         |
| `name`                | String?       |                                               |
| `passwordHash`        | String?       | bcrypt(10)                                    |
| `role`                | UserRole      | ADMIN \| USER                                 |
| `status`              | UserStatus    | ACTIVE \| INACTIVE \| SUSPENDED               |
| `setupToken`          | String?       | Hash SHA-256 do token de setup/reset de senha |
| `setupTokenExpiresAt` | DateTime?     |                                               |
| `mustChangePassword`  | Boolean       | Força troca de senha no próximo login         |
| `deletedAt`           | DateTime?     | Soft delete                                   |
| `lgpdConsentAt`       | DateTime?     | Data do último consentimento LGPD             |

#### `AccessGrant`

Overrides de acesso concedidos manualmente por admin. Permitem acesso sem assinatura ativa.

#### `ConsentRecord`

Log append-only de consentimentos LGPD do usuário.

#### `DataErasureRequest`

Rastreamento de solicitações de exclusão de dados (LGPD).

#### `Invitation`

Convite de usuário com token seguro e pré-atribuição de plano.

---

### Domínio 2 — Planos e Cobrança

#### `Plan`

Planos de assinatura com quotas e features. Agnóstico de provedor.

| Campo             | Tipo       | Descrição                                       |
| ----------------- | ---------- | ----------------------------------------------- |
| `id`              | String     | PK                                              |
| `code`            | String     | Código interno único                            |
| `name`            | String     | Nome exibido                                    |
| `isActive`        | Boolean    | Visível no sistema                              |
| `showOnLanding`   | Boolean    | Exibido na landing page                         |
| `sortOrder`       | Int        | Ordem de exibição                               |
| `hotmartPlanCode` | String?    | Código do plano no Hotmart (vínculo automático) |
| `checkoutUrl`     | String?    | URL de checkout                                 |
| `periodicity`     | PlanPeriod | MONTHLY \| ANNUAL                               |
| `transcriptQuota` | Int        | Máximo de transcrições por período              |
| `scriptQuota`     | Int        | Máximo de insights por período                  |

#### `Subscription`

Assinatura agnóstica de provedor.

| Campo         | Tipo               | Descrição                                             |
| ------------- | ------------------ | ----------------------------------------------------- |
| `status`      | SubscriptionStatus | PENDING \| ACTIVE \| PAST_DUE \| CANCELLED \| EXPIRED |
| `source`      | String             | hotmart \| manual \| invite \| stripe                 |
| `startedAt`   | DateTime?          |                                                       |
| `cancelledAt` | DateTime?          |                                                       |
| `endedAt`     | DateTime?          |                                                       |

#### `HotmartSubscription`

Detalhes específicos do Hotmart, vinculado 1:1 a `Subscription`.

#### `SubscriptionCharge`

Registros de pagamento por assinatura.

#### `ExternalAccountLink`

Vincula `User` a identidades externas (ex: `subscriberCode` do Hotmart).

---

### Domínio 3 — Eventos Hotmart

#### `HotmartWebhookEvent`

Evento de webhook bruto com chave de idempotência, status de processamento e contador de retries.

---

### Domínio 4 — Admin e Observabilidade

#### `AdminNotification`

Inbox de notificações admin com severidade, dedup e relações a User/Subscription/Event.

| Campo      | Tipo                 | Valores                             |
| ---------- | -------------------- | ----------------------------------- |
| `severity` | NotificationSeverity | INFO \| WARNING \| HIGH \| CRITICAL |
| `status`   | NotificationStatus   | UNREAD \| READ \| ARCHIVED          |

#### `AuditLog`

Trilha de auditoria de ações administrativas.

#### `Setting`

Configurações dinâmicas chave-valor (painel admin). Suporta valores em texto plano e criptografados (AES-256-GCM via `lib/crypto.ts`).

**Chaves principais (`SETTING_KEYS` em `lib/settings.ts`):**

| Chave                    | Tipo      | Descrição                      |
| ------------------------ | --------- | ------------------------------ |
| `hotmart.product_id`     | Texto     | ID do produto Hotmart          |
| `hotmart.client_id`      | Texto     | Client ID da API Hotmart       |
| `hotmart.client_secret`  | Criptogr. | Client Secret Hotmart          |
| `hotmart.basic_token`    | Criptogr. | Basic token Hotmart            |
| `hotmart.webhook_secret` | Criptogr. | Secret de validação de webhook |
| `hotmart.sandbox`        | Texto     | Modo sandbox (true/false)      |
| `openai.api_key`         | Criptogr. | Chave da API OpenAI            |

---

### Domínio 5 — Dados Echotik / TikTok Shop

#### `EchotikVideoTrendDaily`

Snapshot diário do ranking de vídeos por região.

Campos relevantes: `videoExternalId`, `country`, `rankDate`, `blobUrl`, `downloadUrl`, `syncedAt`.

#### `EchotikProductTrendDaily`

Snapshot diário do ranking de produtos por região.

#### `EchotikCreatorTrendDaily`

Snapshot diário do ranking de creators por região.

#### `EchotikProductDetail`

Cache de detalhes de produto (enriquecimento). O campo `extra` armazena o payload completo da API Echotik como JSON, incluindo `cover_url` (array `[{url, index}]`), `specification` e métricas de receita. Lido pelo endpoint `GET /api/trending/products/[id]` para popular o `ProductDetailsModal`.

#### `EchotikCategory`

Categorias L1 do TikTok Shop.

#### `EchotikRawResponse`

Respostas brutas da API (debug/reprodutibilidade).

#### `IngestionRun`

Rastreamento de execuções do cron (status, timing, stats).

#### `Region`

Regiões ativas com código PK (ex: "BR", "US", "JP").

---

### Domínio 6 — Conteúdo do Usuário

| Modelo           | Descrição                             |
| ---------------- | ------------------------------------- |
| `SavedItem`      | Vídeos e produtos salvos pelo usuário |
| `Collection`     | Coleções de itens salvos              |
| `CollectionItem` | Item dentro de uma coleção            |
| `Note`           | Nota do usuário em um conteúdo        |
| `Alert`          | Alerta do usuário por item            |

---

### Domínio 7 — Rastreamento de Uso

#### `UsagePeriod`

Agregação mensal de uso por usuário.

#### `UsageEvent`

Evento atômico de consumo com chave de idempotência.

| Tipo (`UsageEventType`) | Descrição            |
| ----------------------- | -------------------- |
| `TRANSCRIPT`            | Transcrição de vídeo |
| `SCRIPT`                | Geração de insight   |
| `INSIGHT`               | (alias de SCRIPT)    |

---

### Domínio 8 — Transcrição

#### `VideoTranscript`

Transcrição sob demanda de vídeos. Uma por `videoExternalId`, compartilhada globalmente entre todos os usuários.

**Ciclo de vida:** `PENDING → PROCESSING → READY | FAILED`

Pipeline: URL de download Echotik → download do vídeo → OpenAI Whisper → verificação de alucinação.

---

### Domínio 9 — Insights

#### `VideoInsight`

Insight IA gerado por usuário por vídeo. Um por `(userId, videoExternalId)`.

**Ciclo de vida:** `PENDING → PROCESSING → READY | FAILED`

Campos de output: `contextText`, `hookText`, `problemText`, `solutionText`, `ctaText`, `copyWorkedText`.

---

## Enums

| Enum                   | Valores                                                |
| ---------------------- | ------------------------------------------------------ |
| `UserRole`             | ADMIN, USER                                            |
| `UserStatus`           | ACTIVE, INACTIVE, SUSPENDED                            |
| `SubscriptionStatus`   | PENDING, ACTIVE, PAST_DUE, CANCELLED, EXPIRED          |
| `ChargeStatus`         | PENDING, PAID, REFUNDED, CANCELLED, CHARGEBACK, FAILED |
| `WebhookStatus`        | RECEIVED, PROCESSING, PROCESSED, FAILED, DUPLICATE     |
| `IngestionStatus`      | RUNNING, SUCCESS, FAILED                               |
| `NotificationSeverity` | INFO, WARNING, HIGH, CRITICAL                          |
| `NotificationStatus`   | UNREAD, READ, ARCHIVED                                 |
| `ErasureStatus`        | PENDING, IN_PROGRESS, COMPLETED, REJECTED              |
| `InvitationStatus`     | PENDING, ACCEPTED, EXPIRED, CANCELLED                  |
| `PlanPeriod`           | MONTHLY, ANNUAL                                        |
| `UsageEventType`       | TRANSCRIPT, SCRIPT, INSIGHT                            |
| `TranscriptStatus`     | PENDING, PROCESSING, READY, FAILED                     |
| `InsightStatus`        | PENDING, PROCESSING, READY, FAILED                     |

---

## Migrações

Veja o guia completo em [docs/deploy.md](deploy.md#migrações-de-banco).

### Resumo do histórico

| Migration                             | Descrição                                 |
| ------------------------------------- | ----------------------------------------- |
| `0000_baseline`                       | Schema inicial                            |
| `20260402_add_video_transcript`       | Modelo VideoTranscript                    |
| `20260404_add_video_insight`          | Modelo VideoInsight                       |
| `20260406_remove_coupon_plan_mapping` | Limpeza de campos externos de plano       |
| `20260407_remove_plan_hotmart_fields` | Remoção de campos Hotmart diretos no Plan |
| `20260408_add_plan_hotmart_plan_code` | hotmartPlanCode no Plan                   |
| `20260408_add_charge_status_overdue`  | Novos valores de ChargeStatus             |
| `20260409_add_cascade_delete`         | Regras de cascade delete                  |
| `20260409_add_user_setup_token`       | setupToken + setupTokenExpiresAt no User  |
| `20260413_add_must_change_password`   | mustChangePassword no User                |
| `20260413_add_blob_url_download_url`  | blobUrl e downloadUrl no trend            |
| `20260415_add_plan_checkout_url`      | checkoutUrl no Plan                       |
| `20260416_add_plan_show_on_landing`   | showOnLanding no Plan                     |

---

## Princípio de não-destrutividade

Migrações devem ser sempre **aditivas**. Nunca dropar colunas, tabelas ou truncar dados sem processo formal:

1. Remover referências no código
2. Fazer deploy e confirmar que nada quebrou
3. Apenas então criar migration para dropar o elemento

Veja mais em [docs/deploy.md](deploy.md).
