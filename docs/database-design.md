# Hyppado — Desenho do Banco de Dados

> Referência técnica do esquema PostgreSQL (Prisma). Última atualização: Março 2026.

---

## Visão Geral

O banco é dividido em **5 domínios** principais:

| Domínio               | Responsabilidade                      | Tabelas Principais                                                                                                          |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Identidade**        | Usuários, autenticação, LGPD          | `User`, `ConsentRecord`, `DataErasureRequest`                                                                               |
| **Comercial**         | Planos, assinaturas, pagamentos       | `Plan`, `Subscription`, `HotmartSubscription`, `SubscriptionCharge`, `Coupon`                                               |
| **Vínculos Externos** | Integração com providers              | `ExternalAccountLink`, `PlanExternalMapping`, `HotmartWebhookEvent`                                                         |
| **Dados TikTok**      | Trends de vídeos, produtos, criadores | `EchotikVideoTrendDaily`, `EchotikProductTrendDaily`, `EchotikCreatorTrendDaily`, `EchotikCategory`, `EchotikProductDetail` |
| **Operacional**       | Config, audit, uso, notificações      | `Setting`, `AuditLog`, `UsagePeriod`, `UsageEvent`, `AdminNotification`, `IngestionRun`, `Region`                           |

---

## Domínio 1 — Identidade do Sistema

O `User` é a entidade central. Nenhum campo de billing externo é obrigatório — o usuário existe de forma autônoma.

### User

| Campo           | Tipo                                | Descrição                     |
| --------------- | ----------------------------------- | ----------------------------- |
| `id`            | UUID                                | PK                            |
| `email`         | String (unique)                     | Email de login                |
| `passwordHash`  | String?                             | bcrypt hash                   |
| `role`          | `ADMIN` / `USER`                    | Controle de acesso            |
| `status`        | `ACTIVE` / `INACTIVE` / `SUSPENDED` | Bloqueio de acesso            |
| `lgpdConsentAt` | DateTime?                           | Último consentimento LGPD     |
| `deletedAt`     | DateTime?                           | Soft delete para anonimização |

### ConsentRecord (append-only)

Registro imutável de cada consentimento dado ou revogado. Campos: `consentType`, `version`, `granted`, `ipAddress`.

### DataErasureRequest

Solicitações LGPD de exclusão de dados. Status: `PENDING` → `IN_PROGRESS` → `COMPLETED` / `REJECTED`.

---

## Domínio 2 — Comercial (Planos, Assinaturas, Pagamentos)

### Plan

Planos de assinatura com quotas de uso.

| Campo                 | Tipo                 | Descrição                           |
| --------------------- | -------------------- | ----------------------------------- |
| `code`                | String (unique)      | Slug: `pro_mensal`, `premium_anual` |
| `priceAmount`         | Int                  | Preço em centavos (5990 = R$59,90)  |
| `periodicity`         | `MONTHLY` / `ANNUAL` | Ciclo de cobrança                   |
| `transcriptsPerMonth` | Int                  | Quota de transcrições               |
| `scriptsPerMonth`     | Int                  | Quota de scripts                    |
| `hotmartProductId`    | String?              | Link legado com produto Hotmart     |

### Subscription (origin-agnostic)

Uma assinatura pertence a um `User` e referencia um `Plan`. O campo `source` identifica a origem.

| Campo                   | Tipo      | Descrição                                                   |
| ----------------------- | --------- | ----------------------------------------------------------- |
| `userId`                | FK → User | Dono da assinatura                                          |
| `planId`                | FK → Plan | Plano vinculado                                             |
| `status`                | Enum      | `PENDING` / `ACTIVE` / `PAST_DUE` / `CANCELLED` / `EXPIRED` |
| `source`                | String    | `hotmart` / `manual` / `invite` / `stripe`                  |
| `startedAt` / `endedAt` | DateTime? | Período ativo                                               |
| `nextChargeAt`          | DateTime? | Próxima cobrança                                            |

### HotmartSubscription

Detalhe específico do Hotmart vinculado 1:1 à `Subscription`.

| Campo                   | Tipo                       | Descrição                     |
| ----------------------- | -------------------------- | ----------------------------- |
| `subscriptionId`        | FK → Subscription (unique) | Vínculo 1:1                   |
| `hotmartSubscriptionId` | String (unique)            | ID da assinatura na Hotmart   |
| `subscriberCode`        | String? (unique)           | Código do assinante           |
| `buyerEmail`            | String?                    | Email do comprador no Hotmart |
| `externalStatus`        | String?                    | Status raw da Hotmart         |

### SubscriptionCharge

Pagamentos e tentativas por assinatura.

| Campo           | Tipo             | Descrição                                                               |
| --------------- | ---------------- | ----------------------------------------------------------------------- |
| `transactionId` | String? (unique) | ID da transação Hotmart                                                 |
| `amountCents`   | Int?             | Valor em centavos                                                       |
| `status`        | Enum             | `PENDING` / `PAID` / `REFUNDED` / `CANCELLED` / `CHARGEBACK` / `FAILED` |

### Coupon

Cupons sincronizados da API Hotmart.

---

## Domínio 3 — Vínculos Externos

### ExternalAccountLink

Vincula um `User` a uma identidade em um provider externo (Hotmart, Stripe, etc). Um User pode ter 0 ou N vínculos.

| Campo                | Tipo    | Descrição                                            |
| -------------------- | ------- | ---------------------------------------------------- |
| `provider`           | String  | `hotmart`, `stripe`, etc.                            |
| `externalCustomerId` | String? | subscriberCode, stripeCustomerId                     |
| `externalEmail`      | String? | Email no provider (pode diferir do email do sistema) |
| `linkConfidence`     | String  | `auto_email` / `manual` / `admin` / `reconciliation` |
| `linkMethod`         | String  | `webhook` / `sync` / `manual` / `invite` / `import`  |

**Unique constraint:** `[provider, externalCustomerId]`.
**Index (lookup only):** `[provider, externalEmail]` — email é mutável, não serve como unique.

### PlanExternalMapping

Mapeia planos internos a IDs de provedores externos. Permite múltiplos providers sem poluir a tabela `Plan`.

### HotmartWebhookEvent

Registro completo de cada evento recebido via webhook Hotmart. Idempotência via SHA-256. Status de processamento: `RECEIVED` → `PROCESSING` → `PROCESSED` / `FAILED` / `DUPLICATE`.

---

## Domínio 4 — Dados TikTok (Echotik)

Snapshots diários de rankings do TikTok Shop, ingeridos por cron.

| Tabela                     | O que armazena                         | Chave única                                                   |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `EchotikVideoTrendDaily`   | Vídeos trending (views, sales, GMV)    | `[videoExternalId, date, country, rankingCycle, rankField]`   |
| `EchotikProductTrendDaily` | Produtos trending (vendas, GMV, preço) | `[productExternalId, date, country, rankingCycle, rankField]` |
| `EchotikCreatorTrendDaily` | Criadores trending (followers, vendas) | `[userExternalId, date, country, rankingCycle, rankField]`    |
| `EchotikCategory`          | Categorias L1 do TikTok Shop           | `externalId`                                                  |
| `EchotikProductDetail`     | Cache de detalhes de produto           | `productExternalId`                                           |
| `EchotikRawResponse`       | Payloads brutos (debug)                | `payloadHash` (SHA-256)                                       |

### IngestionRun

Controle de execuções do cron. Status: `RUNNING` → `SUCCESS` / `FAILED`.

### Region

Regiões/países disponíveis (BR, US, JP, etc). Controlado via admin — usada pelo cron e seletor da UI.

---

## Domínio 5 — Operacional

| Tabela                                        | Responsabilidade                                            |
| --------------------------------------------- | ----------------------------------------------------------- |
| `Setting`                                     | Configurações dinâmicas via admin (chave-valor)             |
| `AuditLog`                                    | Registro de ações relevantes (quem, o que, antes/depois)    |
| `UsagePeriod`                                 | Período mensal de uso por usuário                           |
| `UsageEvent`                                  | Evento atômico de consumo (idempotente)                     |
| `AccessGrant`                                 | Override manual de acesso concedido por admin               |
| `Invitation`                                  | Convites para novos usuários                                |
| `AdminNotification`                           | Alertas para o painel admin (dedup via SHA-256 `dedupeKey`) |
| `SavedItem` / `Collection` / `Note` / `Alert` | Dados do usuário na plataforma                              |

### AdminNotification (detalhes)

| Campo        | Tipo                     | Descrição                                                                |
| ------------ | ------------------------ | ------------------------------------------------------------------------ |
| `source`     | String (default hotmart) | Origem: `hotmart`, `system`, `cron`, `reconciliation`, `import`          |
| `type`       | String                   | Tipo: `SUBSCRIPTION_CHARGEBACK`, `WEBHOOK_INVALID`, `PROCESSING_FAILED`… |
| `severity`   | Enum                     | `INFO` / `WARNING` / `HIGH` / `CRITICAL`                                 |
| `dedupeKey`  | String? (unique)         | SHA-256 determinístico para dedup — null = sempre cria                   |
| `status`     | Enum                     | `UNREAD` / `READ` / `ARCHIVED`                                           |
| `readAt`     | DateTime?                | Timestamp de quando foi marcada como lida                                |
| `archivedAt` | DateTime?                | Timestamp de quando foi arquivada                                        |
| `resolvedAt` | DateTime?                | Timestamp de resolução pelo admin                                        |
| `resolvedBy` | String?                  | userId do admin que resolveu                                             |

---

## Cadeia de Acesso (Access Chain)

```
1. User.status == SUSPENDED/INACTIVE → bloqueia
2. AccessGrant ativo e não expirado → concede acesso (override)
3. Subscription ACTIVE vinculada → concede acesso
4. Fallback → sem acesso
```

---

## Fluxograma — Webhook Hotmart → Assinatura

```mermaid
flowchart TD
    A[Hotmart envia webhook POST] --> B{Validar HOTTOK<br/>timingSafeEqual}
    B -->|Inválido| C[401 Reject]
    B -->|Válido| D[Extrair campos<br/>extractWebhookFields]
    D --> E[Gerar idempotencyKey<br/>SHA-256]
    E --> F{Evento duplicado?}
    F -->|Sim| G[200 DUPLICATE]
    F -->|Não| H[Salvar HotmartWebhookEvent<br/>status=RECEIVED]
    H --> I[processHotmartEvent]
    I --> J[resolveOrCreateIdentity]
    J --> J1{User existe<br/>por email?}
    J1 -->|Sim| J2[Usa User existente]
    J1 -->|Não| J3[Cria User + ExternalAccountLink]
    J2 --> K[resolvePlan]
    J3 --> K
    K --> K1{Plan encontrado<br/>por productId/offerCode?}
    K1 -->|Sim| L[upsertSubscription]
    K1 -->|Não| K2[Usa plano fallback]
    K2 --> L
    L --> L1[Cria/Atualiza Subscription]
    L1 --> L2[Cria/Atualiza HotmartSubscription]
    L2 --> M{Tem transação?}
    M -->|Sim| N[Cria SubscriptionCharge]
    M -->|Não| O[Skip charge]
    N --> P[AuditLog + AdminNotification]
    O --> P
    P --> Q[Marca evento PROCESSED]
    Q --> R[200 OK]

    style A fill:#2DD4FF,color:#000
    style C fill:#f44336,color:#fff
    style G fill:#ff9800,color:#000
    style R fill:#4caf50,color:#fff
```

---

## Fluxograma — Import de Assinantes (Admin)

```mermaid
flowchart TD
    A[Admin clica<br/>Importar Assinantes] --> B[POST /api/admin/import-subscribers]
    B --> C[Ler hotmart.product_id<br/>da tabela Setting]
    C --> D{Product ID<br/>configurado?}
    D -->|Não| E[422 Erro]
    D -->|Sim| F[importSubscribersFromHotmart]
    F --> G{Plan com<br/>hotmartProductId?}
    G -->|Sim| H[Usa plano vinculado]
    G -->|Não| I[Usa primeiro plan ativo<br/>e vincula ao productId]
    H --> J[Fetch paginado<br/>GET /payments/api/v1/subscriptions]
    I --> J
    J --> K[Para cada assinante]
    K --> L{Já importado?<br/>hotmartSubscriptionId<br/>ou subscriberCode}
    L -->|Sim| M[Skip]
    L -->|Não| N[Upsert User por email]
    N --> O[Criar ExternalAccountLink]
    O --> P[Criar Subscription +<br/>HotmartSubscription]
    P --> Q[Próximo assinante]
    M --> Q
    Q --> K
    K -->|Fim| R[Retorna resultado:<br/>imported / skipped / errors]

    style A fill:#2DD4FF,color:#000
    style E fill:#f44336,color:#fff
    style R fill:#4caf50,color:#fff
```

---

## Fluxograma — Sync de Planos e Cupons

```mermaid
flowchart TD
    A[Admin clica<br/>Sincronizar Agora] --> B[POST /api/admin/sync-hotmart]
    B --> C[syncAll productId]
    C --> D[syncHotmartOffers]
    D --> D1[GET /payments/api/v1/offers]
    D1 --> D2{payment_mode<br/>== SUBSCRIPTION?}
    D2 -->|Sim| D3[Upsert Plan<br/>com hotmartProductId/offerCode]
    D2 -->|Não| D4[Skip]
    C --> E[syncHotmartCoupons]
    E --> E1[GET /payments/api/v1/coupons]
    E1 --> E2[Upsert Coupon]
    E2 --> E3[Desativar cupons<br/>removidos na Hotmart]

    style A fill:#2DD4FF,color:#000
```

---

## Fluxograma — Cron Echotik (Ingestão de Dados)

```mermaid
flowchart TD
    A[Vercel Cron trigger<br/>a cada 5 min] --> B[POST /api/cron/echotik]
    B --> C[detectNextTask]
    C --> C1{Próxima tarefa?}
    C1 -->|null| D[200 Nothing to do]
    C1 -->|task + region| E{Qual tarefa?}
    E -->|categories| F[syncCategories]
    E -->|videos| G[syncVideoRanklist<br/>runId, region]
    E -->|products| H[syncProductRanklist<br/>runId, region]
    E -->|creators| I[syncCreatorRanklist<br/>runId, region]
    F --> J[Upsert EchotikCategory]
    G --> K[Upsert EchotikVideoTrendDaily]
    H --> L[Upsert EchotikProductTrendDaily]
    I --> M[Upsert EchotikCreatorTrendDaily]
    J --> N[IngestionRun → SUCCESS]
    K --> N
    L --> N
    M --> N

    style A fill:#2DD4FF,color:#000
    style D fill:#ff9800,color:#000
    style N fill:#4caf50,color:#fff
```

---

## Fluxograma — Cadeia de Acesso do Usuário

```mermaid
flowchart TD
    A[Request autenticado] --> B{User.status}
    B -->|SUSPENDED / INACTIVE| C[Acesso negado]
    B -->|ACTIVE| D{AccessGrant<br/>ativo + não expirado?}
    D -->|Sim| E[Acesso concedido<br/>via override admin]
    D -->|Não| F{Subscription<br/>status == ACTIVE?}
    F -->|Sim| G[Acesso concedido<br/>via assinatura]
    F -->|Não| H[Sem acesso]

    style C fill:#f44336,color:#fff
    style H fill:#f44336,color:#fff
    style E fill:#4caf50,color:#fff
    style G fill:#4caf50,color:#fff
```

---

## Diagrama ER Simplificado

```mermaid
erDiagram
    User ||--o{ Subscription : "tem"
    User ||--o{ ExternalAccountLink : "vinculado a"
    User ||--o{ AccessGrant : "recebe"
    User ||--o{ UsagePeriod : "consome"
    User ||--o{ SavedItem : "salva"
    User ||--o{ AuditLog : "registra"
    User ||--o{ ConsentRecord : "consente"
    User ||--o{ AdminNotification : "gera"

    Plan ||--o{ Subscription : "define"
    Plan ||--o{ PlanExternalMapping : "mapeado"
    Plan ||--o{ AccessGrant : "referencia"

    Subscription ||--o| HotmartSubscription : "detalhe Hotmart"
    Subscription ||--o{ SubscriptionCharge : "pagamentos"
    Subscription ||--o{ AdminNotification : "notifica"

    UsagePeriod ||--o{ UsageEvent : "eventos"

    HotmartWebhookEvent ||--o{ AdminNotification : "notifica"

    IngestionRun ||--o{ EchotikRawResponse : "respostas"

    Collection ||--o{ CollectionItem : "contém"
```

---

## Notas Técnicas

- **IDs**: Todos UUID v4, exceto `Region.code` (string curta: "BR", "US") e `Setting.key` (chave textual).
- **Idempotência**: Webhook via SHA-256 (`idempotencyKey`), Usage via `UsageEvent.idempotencyKey`, Echotik via unique compostas por `[externalId, date, country, cycle, field]`.
- **Soft delete**: Apenas `User.deletedAt` para compliance LGPD.
- **Timestamps**: Todos os models têm `createdAt`; models mutáveis têm `updatedAt`.
- **BigInt**: Usado em métricas Echotik (views, likes, GMV) para suportar valores grandes.
- **Decimal**: Usado em `EchotikProductDetail` para preços com precisão.
