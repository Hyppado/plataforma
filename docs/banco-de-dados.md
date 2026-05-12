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

| Campo                    | Tipo       | Descrição                                                          |
| ------------------------ | ---------- | ------------------------------------------------------------------ |
| `id`                     | String     | PK                                                                 |
| `code`                   | String     | Código interno único                                               |
| `name`                   | String     | Nome exibido                                                       |
| `isActive`               | Boolean    | Visível no sistema                                                 |
| `showOnLanding`          | Boolean    | Exibido na landing page                                            |
| `sortOrder`              | Int        | Ordem de exibição                                                  |
| `hotmartPlanCode`        | String?    | Código do plano no Hotmart (vínculo automático)                    |
| `checkoutUrl`            | String?    | URL de checkout                                                    |
| `periodicity`            | PlanPeriod | MONTHLY \| ANNUAL                                                  |
| `transcriptQuota`        | Int        | Máximo de transcrições por período                                 |
| `scriptQuota`            | Int        | Máximo de insights por período                                     |
| `avatarVideoQuota`       | Int        | Máximo de gerações de vídeo avatar por período                     |
| `influencerIaDailyQuota` | Int        | Máximo de gerações de imagem Influencer IA por dia (UTC); padrão 5 |

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

| Chave                           | Tipo      | Descrição                                                                                        |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `hotmart.product_id`            | Texto     | ID do produto Hotmart                                                                            |
| `hotmart.client_id`             | Texto     | Client ID da API Hotmart                                                                         |
| `hotmart.client_secret`         | Criptogr. | Client Secret Hotmart                                                                            |
| `hotmart.basic_token`           | Criptogr. | Basic token Hotmart                                                                              |
| `hotmart.webhook_secret`        | Criptogr. | Secret de validação de webhook                                                                   |
| `hotmart.sandbox`               | Texto     | Modo sandbox (true/false)                                                                        |
| `openai.api_key`                | Criptogr. | Chave da API OpenAI                                                                              |
| `openai.whisper_model`          | Texto     | Modelo Whisper (padrão: `whisper-1`)                                                             |
| `openai.whisper_language`       | Texto     | Idioma para Whisper (padrão: `pt`)                                                               |
| `avatar_video.prompt_template`  | Texto     | Template de sistema para geração de prompt VEO 3                                                 |
| `avatar_video.concept_template` | Texto     | Template de sistema para geração de conceito de vídeo                                            |
| `avatar_video.image_template`   | Texto     | Template para geração de imagem (vazio = prompt automático por categoria)                        |
| `google_ai.api_key`             | Criptogr. | Chave da API Google AI Studio (Gemini)                                                           |
| `google_ai.model`               | Texto     | Modelo Gemini (padrão: `gemini-3.1-flash-image-preview`)                                         |
| `influencer_ia_daily_limit`     | Texto     | Limite diário global de gerações Influencer IA (fallback quando plano não tem quota configurada) |

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

| Tipo (`UsageEventType`)   | `refTable`                 | Descrição                                           |
| ------------------------- | -------------------------- | --------------------------------------------------- |
| `TRANSCRIPT`              | —                          | Transcrição de vídeo                                |
| `SCRIPT`                  | —                          | Geração de insight (verifica contagem + tokens)     |
| `INSIGHT`                 | —                          | Geração de insight (verifica tokens; sem contagem)  |
| `AVATAR_VIDEO_GENERATION` | `"AvatarVideoCreation"`    | Geração de material para vídeo com avatar           |
| `AVATAR_VIDEO_GENERATION` | `"InfluencerIAGeneration"` | Geração de imagem via Influencer IA (limite diário) |

`SCRIPT` e `INSIGHT` são tipos distintos — não são aliases:

| Tipo      | Quota verificada                                                 | Contador de período |
| --------- | ---------------------------------------------------------------- | ------------------- |
| `SCRIPT`  | `scriptsPerMonth` (contagem) + `scriptTokensMonthlyMax` (tokens) | `scriptsUsed`       |
| `INSIGHT` | `insightTokensMonthlyMax` (tokens apenas)                        | `insightsUsed`      |

O campo `refTable` discrimina os dois usos de `AVATAR_VIDEO_GENERATION`: Avatar Video debita quota mensal do plano via `UsagePeriod`; Influencer IA usa apenas contagem diária sobre `UsageEvent` (sem `UsagePeriod`).

---

### Domínio 8 — Geração de Vídeo com Avatar

Fluxo guiado de criação de material para vídeos UGC com avatares. Existe no máximo uma criação em status `DRAFT` por usuário — quando o usuário inicia um novo fluxo, o DRAFT existente é reaproveitado. Criações `FAILED` não são reaproveitadas — um novo DRAFT é criado. Uma criação `COMPLETED` não impede a criação de um novo DRAFT.

> Administração de `AvatarProfile` e `VideoScenario` é feita em **`/dashboard/config` → aba "Vídeo com Avatar"** (sub-abas **Avatares** e **Cenários**; rotas em `app/api/admin/avatar-video/*`). DELETE de avatar/cenário com criações associadas faz soft-deactivate (`isActive=false`); sem referências, faz hard-delete. Templates de prompt VEO 3 e conceito são configurados na aba **Geral** do painel (via `PromptsSection`). O endpoint de usuário (`/api/avatar-video/avatars`) sempre filtra por `isActive=true`.

#### `AvatarProfile`

Biblioteca de avatares cadastrados pelo admin.

| Campo          | Tipo    | Descrição                       |
| -------------- | ------- | ------------------------------- |
| `name`         | String  | Nome do avatar                  |
| `imageUrl`     | String  | URL da imagem em alta resolução |
| `thumbnailUrl` | String? | URL do thumbnail                |
| `isActive`     | Boolean | Exibido para seleção do usuário |
| `sortOrder`    | Int     | Ordem de exibição               |

#### `VideoScenario`

Templates de cenário/contexto para guiar a geração de imagens e prompt VEO 3.

| Campo         | Tipo    | Descrição                                                  |
| ------------- | ------- | ---------------------------------------------------------- |
| `name`        | String  | Nome do cenário                                            |
| `description` | String? | Descrição livre do cenário                                 |
| `promptHint`  | String? | Instrução de ambiente/setting injetada no prompt de imagem |
| `isDefault`   | Boolean | Selecionado por padrão na UI                               |
| `isActive`    | Boolean | Disponível para seleção do usuário                         |
| `sortOrder`   | Int     | Ordem de exibição                                          |

#### `AvatarVideoCreation`

Sessão de geração por usuário. Um registro por usuário — sobrescrito a cada nova geração.

**Ciclo de vida (`AvatarVideoCreationStatus`):** `DRAFT → PENDING_IMAGES → IMAGES_READY → PENDING_CONCEPT → CONCEPT_READY → PENDING_PROMPT → PROMPT_READY → COMPLETED | FAILED`

| Campo                       | Tipo    | Descrição                                                                |
| --------------------------- | ------- | ------------------------------------------------------------------------ |
| `userId`                    | String  | FK para User (cascade delete)                                            |
| `avatarProfileId`           | String? | Avatar selecionado (set null se deletado)                                |
| `videoScenarioId`           | String? | Cenário selecionado (set null se deletado)                               |
| `status`                    | Enum    | Estado atual do fluxo                                                    |
| `tone`                      | String? | Tom do vídeo (ex: professional, casual, energetic)                       |
| `duration`                  | String? | Duração alvo (ex: 15s, 30s, 60s)                                         |
| `takeCount`                 | Int?    | Número de takes (1–5 via seleção de cenário; 1–12 via geração de prompt) |
| `productExternalId`         | String? | ID externo do produto TikTok Shop selecionado                            |
| `productName`               | String? | Nome snapshot do produto                                                 |
| `productImageUrl`           | String? | Imagem principal snapshot (URL Echotik)                                  |
| `productSelectedImageUrl`   | String? | Imagem escolhida pelo usuário para referência (pode ser Blob URL)        |
| `productPriceCents`         | Int?    | Preço snapshot em centavos                                               |
| `productCurrency`           | String? | Moeda do preço (ex: USD, BRL)                                            |
| `productCategory`           | String? | Categoria snapshot (texto desnormalizado)                                |
| `uploadedAvatarImageUrl`    | String? | Vercel Blob URL da foto de avatar enviada pelo usuário                   |
| `customScenarioDescription` | String? | Texto livre de cenário (quando usuário não escolhe cenário pré-definido) |
| `selectedImageVariationId`  | String? | ID da variação de imagem preferida pelo usuário (limpo na regeneração)   |

#### `AvatarVideoConcept`

Conceito de vídeo gerado por IA para uma sessão (1:1 com `AvatarVideoCreation`).

**Ciclo de vida (`AvatarVideoConceptStatus`):** `PENDING → PROCESSING → READY | FAILED`

| Campo        | Tipo    | Descrição                                      |
| ------------ | ------- | ---------------------------------------------- |
| `videoIdea`  | String? | Resumo geral da ideia do vídeo                 |
| `hook`       | String? | Frase de gancho inicial (em português)         |
| `copy`       | String? | Texto de copy/roteiro principal (em português) |
| `cta`        | String? | Call-to-action (em português)                  |
| `scenesJson` | Json?   | `[{ sceneNumber, goal, description }]`         |
| `isEdited`   | Boolean | Indica se o usuário editou o conceito gerado   |

#### `AvatarVideoImageVariation`

Referências de imagem geradas (até 2 por criação, em paralelo).

**Ciclo de vida (`AvatarVideoImageStatus`):** `PENDING → PROCESSING → READY | FAILED`

| Campo          | Tipo    | Descrição                                            |
| -------------- | ------- | ---------------------------------------------------- |
| `creationId`   | String  | FK para AvatarVideoCreation (cascade delete)         |
| `blobUrl`      | String? | URL pública no Vercel Blob (disponível quando READY) |
| `sortOrder`    | Int     | Índice do slot: 0 ou 1                               |
| `errorMessage` | String? | Mensagem de erro quando FAILED                       |

Quando o usuário solicita regeneração, todas as variações anteriores são deletadas e `selectedImageVariationId` na criação é limpo.

#### `AvatarVideoPrompt`

Prompt VEO 3 gerado (1:1 com criação).

**Ciclo de vida (`AvatarVideoPromptStatus`):** `PENDING → PROCESSING → READY | FAILED`

| Campo        | Tipo      | Descrição                                                                                         |
| ------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `promptJson` | Json?     | Payload estruturado `Veo3Prompt` (takes, duração, aspectRatio…)                                   |
| `promptText` | String?   | Texto de visão geral (`prompt` do `Veo3Prompt`) — NOT the full JSON; full JSON is in `promptJson` |
| `isEdited`   | Boolean   | Indica se o usuário editou o prompt após a geração                                                |
| `editedAt`   | DateTime? | Timestamp da última edição manual                                                                 |

---

### Domínio 11 — Biblioteca de Prompts

#### `PromptLibraryItem`

Exemplos de prompt curados manualmente pelo admin, exibidos como inspiração aos usuários.

Independente do fluxo Avatar Video — não está vinculado a sessões de geração do usuário.

| Campo          | Tipo     | Descrição                                                 |
| -------------- | -------- | --------------------------------------------------------- |
| `id`           | String   | PK (cuid)                                                 |
| `title`        | String   | Título do exemplo                                         |
| `category`     | String   | Categoria em texto livre                                  |
| `description`  | String?  | Descrição opcional do exemplo                             |
| `videoBlobUrl` | String   | URL do vídeo de loop (Vercel Blob)                        |
| `promptText`   | String   | Texto do prompt associado                                 |
| `isActive`     | Boolean  | Controla visibilidade pública (padrão: `true`)            |
| `createdById`  | String?  | FK opcional para o admin que criou (`ON DELETE SET NULL`) |
| `createdAt`    | DateTime | Data de criação                                           |
| `updatedAt`    | DateTime | Última atualização                                        |

Índices: `category`, `isActive`, `createdAt`.

---

### Domínio 9 — Transcrição

#### `VideoTranscript`

Transcrição sob demanda de vídeos. Uma por `videoExternalId`, compartilhada globalmente entre todos os usuários.

**Ciclo de vida:** `PENDING → PROCESSING → READY | FAILED`

Pipeline: URL de download Echotik → download do vídeo → OpenAI Whisper → verificação de alucinação.

---

### Domínio 10 — Insights

#### `VideoInsight`

Insight IA gerado por usuário por vídeo. Um por `(userId, videoExternalId)`.

**Ciclo de vida:** `PENDING → PROCESSING → READY | FAILED`

Campos de output: `contextText`, `hookText`, `problemText`, `solutionText`, `ctaText`, `copyWorkedText`.

---

### Domínio 12 — Uploads de Avatar do Usuário

#### `UserAvatarUpload`

Armazena URLs de imagens de avatar enviadas pelo usuário para reutilização no wizard Influencer IA. Múltiplos registros por usuário (galéria pessoal).

| Campo       | Tipo     | Descrição                              |
| ----------- | -------- | -------------------------------------- |
| `id`        | String   | PK (cuid)                              |
| `userId`    | String   | FK para User (cascade delete)          |
| `blobUrl`   | String   | URL pública no Vercel Blob             |
| `label`     | String?  | Rótulo opcional atribuído pelo usuário |
| `createdAt` | DateTime | Data de criação                        |

Índices: `(userId, createdAt)`.

---

### Domínio 13 — Influencer IA Draft

#### `InfluencerIADraft`

Estado completo do wizard Influencer IA persistido por usuário. Permite recuperar o progresso entre sessões e dispositivos. Um registro por usuário (upsert a cada salvar, delete no reset).

| Campo       | Tipo     | Descrição                            |
| ----------- | -------- | ------------------------------------ |
| `id`        | String   | PK (cuid)                            |
| `userId`    | String   | Unique FK para User (cascade delete) |
| `data`      | Json     | Estado arbitrário do wizard          |
| `updatedAt` | DateTime | Timestamp da última atualização      |

---

## Enums

| Enum                        | Valores                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `UserRole`                  | ADMIN, USER                                                                                                          |
| `UserStatus`                | ACTIVE, INACTIVE, SUSPENDED                                                                                          |
| `SubscriptionStatus`        | PENDING, ACTIVE, PAST_DUE, CANCELLED, EXPIRED                                                                        |
| `ChargeStatus`              | PENDING, PAID, REFUNDED, CANCELLED, CHARGEBACK, FAILED                                                               |
| `WebhookStatus`             | RECEIVED, PROCESSING, PROCESSED, FAILED, DUPLICATE                                                                   |
| `IngestionStatus`           | RUNNING, SUCCESS, FAILED                                                                                             |
| `NotificationSeverity`      | INFO, WARNING, HIGH, CRITICAL                                                                                        |
| `NotificationStatus`        | UNREAD, READ, ARCHIVED                                                                                               |
| `ErasureStatus`             | PENDING, IN_PROGRESS, COMPLETED, REJECTED                                                                            |
| `InvitationStatus`          | PENDING, ACCEPTED, EXPIRED, CANCELLED                                                                                |
| `PlanPeriod`                | MONTHLY, ANNUAL                                                                                                      |
| `UsageEventType`            | TRANSCRIPT, SCRIPT, INSIGHT, AVATAR_VIDEO_GENERATION                                                                 |
| `AvatarVideoCreationStatus` | DRAFT, PENDING_IMAGES, IMAGES_READY, PENDING_CONCEPT, CONCEPT_READY, PENDING_PROMPT, PROMPT_READY, COMPLETED, FAILED |
| `AvatarVideoImageStatus`    | PENDING, PROCESSING, READY, FAILED                                                                                   |
| `AvatarVideoPromptStatus`   | PENDING, PROCESSING, READY, FAILED                                                                                   |
| `AvatarVideoConceptStatus`  | PENDING, PROCESSING, READY, FAILED                                                                                   |
| `TranscriptStatus`          | PENDING, PROCESSING, READY, FAILED                                                                                   |
| `InsightStatus`             | PENDING, PROCESSING, READY, FAILED                                                                                   |

---

## Migrações

Veja o guia completo em [docs/deploy.md](deploy.md#migrações-de-banco).

### Resumo do histórico

| Migration                                              | Descrição                                                |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `0000_baseline`                                        | Schema inicial                                           |
| `20260402_add_video_transcript`                        | Modelo VideoTranscript                                   |
| `20260404_add_video_insight`                           | Modelo VideoInsight                                      |
| `20260406_remove_coupon_plan_mapping`                  | Limpeza de campos externos de plano                      |
| `20260407_remove_plan_hotmart_fields`                  | Remoção de campos Hotmart diretos no Plan                |
| `20260408_add_plan_hotmart_plan_code`                  | hotmartPlanCode no Plan                                  |
| `20260408_add_charge_status_overdue`                   | Novos valores de ChargeStatus                            |
| `20260409_add_cascade_delete`                          | Regras de cascade delete                                 |
| `20260409_add_user_setup_token`                        | setupToken + setupTokenExpiresAt no User                 |
| `20260413_add_must_change_password`                    | mustChangePassword no User                               |
| `20260413_add_blob_url_download_url`                   | blobUrl e downloadUrl no trend                           |
| `20260415_add_plan_checkout_url`                       | checkoutUrl no Plan                                      |
| `20260416_add_plan_show_on_landing`                    | showOnLanding no Plan                                    |
| `20260418_add_category_name_pt`                        | nome em português nas categorias                         |
| `20260418_add_first_crawl_dt_to_product`               | firstCrawlDt em EchotikProductDetail                     |
| `20260419_add_admin_notification`                      | Modelo AdminNotification                                 |
| `20260419_fix_admin_notification_columns`              | Correção de colunas em AdminNotification                 |
| `20260427_add_avatar_video_creation_flow`              | Modelos do fluxo de vide com avatar                      |
| `20260427_add_avatar_video_quota`                      | avatarVideoQuota no Plan + AVATAR_VIDEO_GENERATION       |
| `20260427_add_avatar_video_selections`                 | Seleções avançadas em AvatarVideoCreation (tone, etc)    |
| `20260427_seed_default_video_scenarios`                | Cenários padrão para VideoScenario                       |
| `20260427_add_selected_image_variation_id`             | selectedImageVariationId em AvatarVideoCreation          |
| `20260428_add_avatar_video_concept`                    | Modelo AvatarVideoConcept + CONCEPT_READY status         |
| `20260429_add_prompt_library_item`                     | Modelo PromptLibraryItem (biblioteca de prompts)         |
| `20260429221540_add_user_avatar_uploads`               | Modelo UserAvatarUpload (galeria de avatares do usuário) |
| `20260430013733_add_influencer_ia_draft`               | Modelo InfluencerIADraft (persistência do wizard)        |
| `20260430021842_add_influencer_ia_daily_quota_to_plan` | influencerIaDailyQuota no Plan                           |

---

## Princípio de não-destrutividade

Migrações devem ser sempre **aditivas**. Nunca dropar colunas, tabelas ou truncar dados sem processo formal:

1. Remover referências no código
2. Fazer deploy e confirmar que nada quebrou
3. Apenas então criar migration para dropar o elemento

Veja mais em [docs/deploy.md](deploy.md).
