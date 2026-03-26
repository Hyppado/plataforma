# Hyppado — Arquitetura IAM / Billing / LGPD

> **Versão:** 1.0 · **Data:** 2025-01-XX · **Status:** Aprovado para implementação

---

## Resumo Executivo

Este documento descreve a arquitetura de separação entre **Identidade/Acesso (IAM)**, **Billing/Comercial** e **Conformidade LGPD** para o SaaS Hyppado, vendido via Hotmart.

**Princípios-chave:**

1. **Identidade ≠ Billing** — O ciclo de vida do usuário (cadastro, suspensão, exclusão) é independente do ciclo de vida da assinatura (compra, renovação, cancelamento).
2. **Acesso é derivado** — O status efetivo de acesso (`AccessStatus`) é _computado_ a partir de `UserStatus` + `SubscriptionStatus` + `AccessGrant`, nunca armazenado como verdade única.
3. **Hotmart como fonte comercial** — Webhooks Hotmart são a fonte de verdade para eventos comerciais; o sistema mantém estado interno com reconciliação.
4. **LGPD by design** — Consentimento rastreado, retenção com política, anonimização/exclusão sob demanda.
5. **Idempotência total** — Todo processamento de webhook é idempotente via SHA-256 key + status machine.

---

## 1. Arquitetura Conceitual

### 1.1 Domínios

```
┌─────────────────────────────────────────────────────────┐
│                    HYPPADO PLATFORM                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │     IAM      │  │   BILLING    │  │   PRODUCT    │   │
│  │              │  │              │  │              │   │
│  │ User         │  │ Plan         │  │ Echotik*     │   │
│  │ UserRole     │  │ Subscription │  │ SavedItem    │   │
│  │ AccessGrant  │  │ HotmartSub   │  │ Collection   │   │
│  │ Invitation   │  │ SubCharge    │  │ Note/Alert   │   │
│  │ Session/JWT  │  │ Coupon       │  │ UsagePeriod  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │
│         │                 │                              │
│  ┌──────┴─────────────────┴──────┐                       │
│  │      ACCESS RESOLVER          │ ← computa acesso      │
│  │  f(UserStatus, SubStatus,     │   efetivo em runtime   │
│  │    AccessGrant) → AccessStatus│                       │
│  └───────────────────────────────┘                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ INTEGRATION  │  │   AUDIT &    │                      │
│  │              │  │  COMPLIANCE  │                      │
│  │ HotmartIdent │  │              │                      │
│  │ WebhookEvent │  │ AuditLog     │                      │
│  │ Webhook Proc │  │ ConsentRec   │                      │
│  │ Subscriber   │  │ ErasureReq   │                      │
│  │   Sync       │  │ RetentionPol │                      │
│  └──────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Separação IAM × Billing

| Aspecto              | IAM (Identidade)                                    | Billing (Comercial)                                                  |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| **Entidade raiz**    | `User`                                              | `Subscription`                                                       |
| **Status**           | `UserStatus` (ACTIVE, INACTIVE, SUSPENDED)          | `SubscriptionStatus` (PENDING, ACTIVE, PAST_DUE, CANCELLED, EXPIRED) |
| **Ciclo de vida**    | Cadastro → Ativação → [Suspensão] → [Exclusão LGPD] | Compra → Ativação → [Atraso] → [Cancelamento] → [Expiração]          |
| **Fonte de verdade** | Sistema interno (NextAuth + Prisma)                 | Hotmart (webhooks + sync)                                            |
| **Quem controla**    | Admin ou sistema                                    | Hotmart + Admin (override via AccessGrant)                           |

### 1.3 Fluxo de Resolução de Acesso

```
resolveUserAccess(userId):
  1. user = findUser(userId)
  2. if user.status == SUSPENDED → SUSPENDED
  3. if user.status == INACTIVE  → NO_ACCESS
  4. if user.deletedAt != null   → NO_ACCESS (LGPD soft-delete)
  5. grant = findActiveAccessGrant(userId)
     if grant exists → FULL_ACCESS (source: manual_grant, plan: grant.plan)
  6. sub = findActiveSubscription(userId)
     if sub.status == ACTIVE     → FULL_ACCESS (source: subscription)
     if sub.status == PAST_DUE   → GRACE_PERIOD (source: subscription)
  7. → NO_ACCESS (sem assinatura ativa)
```

**Prioridade:** `UserStatus` > `AccessGrant` > `SubscriptionStatus`

---

## 2. Modelagem de Dados

### 2.1 Entidades Novas

#### AccessGrant (Override Manual de Acesso)

Permite que um admin conceda acesso independente de assinatura (cortesias, beta testers, parceiros).

| Campo     | Tipo          | Descrição                     |
| --------- | ------------- | ----------------------------- |
| id        | UUID PK       |                               |
| userId    | UUID FK→User  | Usuário beneficiado           |
| grantedBy | UUID          | Admin que concedeu            |
| reason    | String        | Motivo registrado             |
| planId    | UUID? FK→Plan | Plano de referência (quotas)  |
| startsAt  | DateTime      | Início da concessão           |
| expiresAt | DateTime?     | Expiração (null = permanente) |
| isActive  | Boolean       | Flag de revogação rápida      |
| revokedAt | DateTime?     | Quando foi revogada           |
| revokedBy | String?       | Admin que revogou             |
| createdAt | DateTime      |                               |
| updatedAt | DateTime      |                               |

#### ConsentRecord (LGPD — Registro de Consentimento)

Cada consentimento dado pelo usuário é um registro imutável.

| Campo       | Tipo         | Descrição                                           |
| ----------- | ------------ | --------------------------------------------------- |
| id          | UUID PK      |                                                     |
| userId      | UUID FK→User |                                                     |
| consentType | String       | "terms_of_use", "privacy_policy", "marketing_email" |
| version     | String       | Versão do documento aceito                          |
| granted     | Boolean      | true = consentiu, false = revogou                   |
| ipAddress   | String?      | IP no momento do consentimento                      |
| userAgent   | String?      | UA no momento                                       |
| createdAt   | DateTime     | Imutável (append-only)                              |

#### DataErasureRequest (LGPD — Solicitação de Exclusão)

Pedido formal de exclusão de dados pessoais.

| Campo            | Tipo          | Descrição                                    |
| ---------------- | ------------- | -------------------------------------------- |
| id               | UUID PK       |                                              |
| userId           | UUID FK→User  |                                              |
| status           | ErasureStatus | PENDING → IN_PROGRESS → COMPLETED / REJECTED |
| requestedAt      | DateTime      |                                              |
| processedAt      | DateTime?     |                                              |
| processedBy      | String?       | Admin que processou                          |
| notes            | String?       | Notas do processamento                       |
| anonymizedFields | Json?         | Lista de campos anonimizados                 |

#### Invitation (Convites)

Convites enviados por admin para novos usuários.

| Campo      | Tipo             | Descrição                                |
| ---------- | ---------------- | ---------------------------------------- |
| id         | UUID PK          |                                          |
| email      | String           | Email do convidado                       |
| invitedBy  | String           | Admin que convidou                       |
| planId     | UUID? FK→Plan    | Plano pré-atribuído                      |
| role       | UserRole         | Papel pré-atribuído                      |
| status     | InvitationStatus | PENDING → ACCEPTED / EXPIRED / CANCELLED |
| token      | String UNIQUE    | Token seguro para aceitar                |
| expiresAt  | DateTime         | Expiração do convite                     |
| acceptedAt | DateTime?        |                                          |
| userId     | String?          | Preenchido quando aceito                 |
| createdAt  | DateTime         |                                          |

### 2.2 Modificações em Entidades Existentes

#### User (adições)

```diff
+ lgpdConsentAt      DateTime?     // último consentimento LGPD
+ lgpdConsentVersion String?       // versão do termo aceito
+ deletedAt          DateTime?     // soft delete para LGPD
+
+ accessGrants       AccessGrant[]
+ consentRecords     ConsentRecord[]
+ erasureRequests    DataErasureRequest[]
```

#### Plan (adição)

```diff
+ accessGrants       AccessGrant[]
```

### 2.3 Enums Novos

```prisma
enum ErasureStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  REJECTED
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  CANCELLED
}
```

### 2.4 Diagrama ER (Domínio IAM + Billing)

```
User ──1:N──> Subscription ──1:1──> HotmartSubscription
  │                │
  │                └──1:N──> SubscriptionCharge
  │
  ├──1:1──> HotmartIdentity
  ├──1:N──> AccessGrant ──N:1──> Plan
  ├──1:N──> ConsentRecord
  ├──1:N──> DataErasureRequest
  ├──1:N──> UsagePeriod ──1:N──> UsageEvent
  ├──1:N──> AuditLog
  └──1:N──> SavedItem / Collection / Note / Alert
```

---

## 3. Máquinas de Estado

### 3.1 UserStatus (Identidade)

```
             ┌──────────┐
 cadastro    │          │ admin ativa
 ──────────► │ ACTIVE   │ ◄───────────
             │          │            │
             └──┬───┬───┘            │
    admin       │   │     admin      │
    suspende    │   │     desativa   │
                ▼   ▼                │
         ┌─────────┐ ┌──────────┐   │
         │SUSPENDED│ │ INACTIVE │───┘
         └────┬────┘ └──────────┘
              │           ▲
              └───────────┘ admin desativa
```

- **ACTIVE**: Conta funcional, acesso depende de subscription/grant.
- **SUSPENDED**: Bloqueio temporário (fraude, abuso). Nega todo acesso.
- **INACTIVE**: Desativado (LGPD soft-delete ou admin). Pode ser reativado.

### 3.2 SubscriptionStatus (Comercial)

```
  PURCHASE_APPROVED                    PURCHASE_DELAYED
  ────────────────►  ┌────────┐  ─────────────────►  ┌──────────┐
                     │ ACTIVE │                       │ PAST_DUE │
  PURCHASE_COMPLETE  └───┬──┬─┘  ◄─────────────────  └────┬─────┘
  ────────────────►      │  │    PURCHASE_APPROVED         │
                         │  │                              │
      SUBSCRIPTION_      │  │ PURCHASE_CANCELED/           │ SUBSCRIPTION_
      CANCELLATION       │  │ PURCHASE_REFUNDED            │ CANCELLATION
                         ▼  ▼                              ▼
                    ┌───────────┐                    ┌───────────┐
                    │ CANCELLED │                    │ CANCELLED │
                    └─────┬─────┘                    └───────────┘
                          │ TTL expirado
                          ▼
                    ┌───────────┐
                    │  EXPIRED  │
                    └───────────┘
```

### 3.3 AccessStatus (Derivado — nunca persistido)

```typescript
type AccessStatus = "FULL_ACCESS" | "GRACE_PERIOD" | "NO_ACCESS" | "SUSPENDED";

// É COMPUTADO, não armazenado:
// f(UserStatus, SubscriptionStatus, AccessGrant[]) → AccessStatus
```

| UserStatus | Subscription | AccessGrant | → AccessStatus |
| ---------- | ------------ | ----------- | -------------- |
| SUSPENDED  | _qualquer_   | _qualquer_  | SUSPENDED      |
| INACTIVE   | _qualquer_   | _qualquer_  | NO_ACCESS      |
| ACTIVE     | —            | ativo       | FULL_ACCESS    |
| ACTIVE     | ACTIVE       | —           | FULL_ACCESS    |
| ACTIVE     | PAST_DUE     | —           | GRACE_PERIOD   |
| ACTIVE     | CANCELLED    | —           | NO_ACCESS      |
| ACTIVE     | —            | —           | NO_ACCESS      |

---

## 4. Integração Hotmart — Mapeamento Webhook → Ação

### 4.1 Tabela de Eventos

| Evento Hotmart                    | Categoria     | Ação no Sistema                                                                    |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `PURCHASE_APPROVED`               | Ativação      | Resolve identidade → Upsert Subscription(ACTIVE) → Upsert Charge(PAID) → AuditLog  |
| `PURCHASE_COMPLETE`               | Ativação      | Idem APPROVED (confirmação pós-antichargeback)                                     |
| `PURCHASE_CANCELED`               | Cancelamento  | Subscription → CANCELLED → Charge(CANCELLED) → AuditLog                            |
| `PURCHASE_REFUNDED`               | Cancelamento  | Subscription → CANCELLED → Charge(REFUNDED) → AuditLog                             |
| `PURCHASE_CHARGEBACK`             | Cancelamento  | Subscription → CANCELLED → Charge(CHARGEBACK) → User.status → SUSPENDED → AuditLog |
| `PURCHASE_DELAYED`                | Atraso        | Subscription → PAST_DUE → Charge(FAILED) → AuditLog                                |
| `SUBSCRIPTION_CANCELLATION`       | Cancelamento  | Subscription → CANCELLED → AuditLog                                                |
| `SWITCH_PLAN`                     | Mudança       | Subscription.planId atualizado → AuditLog com before/after                         |
| `PURCHASE_BILLET_PRINTED`         | Informacional | Apenas AuditLog                                                                    |
| `PURCHASE_OUT_OF_SHOPPING_CART`   | Informacional | Apenas AuditLog                                                                    |
| `CART_ABANDONMENT`                | Informacional | Apenas AuditLog                                                                    |
| `UPDATE_SUBSCRIPTION_CHARGE_DATE` | Informacional | Atualiza nextChargeAt + AuditLog                                                   |
| `CLUB_FIRST_ACCESS`               | Informacional | Apenas AuditLog                                                                    |
| `CLUB_MODULE_COMPLETED`           | Informacional | Apenas AuditLog                                                                    |

### 4.2 Regra de Chargeback → Suspensão Automática

```
PURCHASE_CHARGEBACK:
  1. Subscription → CANCELLED
  2. Charge → CHARGEBACK
  3. User.status → SUSPENDED (bloqueio imediato)
  4. AuditLog com action = "AUTO_SUSPENSION_CHARGEBACK"
```

**Justificativa:** Chargeback indica fraude ou disputa grave. A suspensão protege a plataforma até análise do admin.

### 4.3 Fluxo de Processamento (existente, validado)

```
Webhook HTTP POST
  │
  ├─ extractWebhookFields(payload)
  ├─ buildIdempotencyKey(fields)
  ├─ Upsert HotmartWebhookEvent (idempotente)
  │     status=RECEIVED, se já existe → DUPLICATE
  │
  ├─ processHotmartEvent(webhookEventId, fields)
  │     status → PROCESSING
  │     │
  │     ├─ INFORMATIONAL? → AuditLog → PROCESSED
  │     │
  │     ├─ resolveOrCreateIdentity(fields) → User + HotmartIdentity
  │     ├─ resolvePlan(fields) → Plan
  │     ├─ upsertSubscription(fields, userId, planId, newStatus)
  │     ├─ upsertCharge (se transactionId presente)
  │     ├─ AuditLog
  │     └─ markProcessed → PROCESSED
  │
  └─ Erro? → withRetry(3x, backoff) → FAILED + errorMessage
```

### 4.4 Replay de Webhook (Admin)

```
POST /api/admin/webhook-events/replay
  { eventId: string }
  │
  ├─ Busca HotmartWebhookEvent por ID
  ├─ Reseta processingStatus → RECEIVED
  ├─ Re-extrai fields do payloadJson
  ├─ Chama processHotmartEvent novamente
  ├─ AuditLog com action = "WEBHOOK_REPLAY"
  └─ Retorna resultado
```

---

## 5. Área Admin — Capacidades

### 5.1 Gestão de Usuários

| Operação         | Endpoint                                    | Descrição                                |
| ---------------- | ------------------------------------------- | ---------------------------------------- |
| Listar           | `GET /api/admin/users`                      | Paginado, filtro por status/role/email   |
| Detalhe          | `GET /api/admin/users/[id]`                 | User + subscriptions + grants + usage    |
| Atualizar status | `PATCH /api/admin/users/[id]`               | Mudar status (ACTIVE/INACTIVE/SUSPENDED) |
| Reset senha      | `POST /api/admin/users/[id]/reset-password` | Gera senha temporária                    |

### 5.2 Gestão de Access Grants

| Operação | Endpoint                               | Descrição                   |
| -------- | -------------------------------------- | --------------------------- |
| Listar   | `GET /api/admin/access-grants`         | Filtro por userId, isActive |
| Criar    | `POST /api/admin/access-grants`        | Concede acesso manual       |
| Revogar  | `DELETE /api/admin/access-grants/[id]` | Revoga grant                |

### 5.3 Gestão de Webhooks

| Operação       | Endpoint                                | Descrição                   |
| -------------- | --------------------------------------- | --------------------------- |
| Listar eventos | `GET /api/admin/webhook-events`         | Filtro por status/tipo/data |
| Replay         | `POST /api/admin/webhook-events/replay` | Reprocessa evento           |

### 5.4 LGPD

| Operação       | Endpoint                                        | Descrição         |
| -------------- | ----------------------------------------------- | ----------------- |
| Listar pedidos | `GET /api/admin/erasure-requests`               | Filtro por status |
| Processar      | `POST /api/admin/erasure-requests/[id]/process` | Anonimiza dados   |

---

## 6. LGPD e Retenção de Dados

### 6.1 Bases Legais

| Dado                     | Base Legal (LGPD Art. 7º)      | Retenção                  |
| ------------------------ | ------------------------------ | ------------------------- |
| Email, nome              | Execução de contrato (II)      | Duração da conta + 5 anos |
| Dados de pagamento       | Obrigação legal/fiscal (II, V) | 5 anos após transação     |
| Logs de uso (UsageEvent) | Legítimo interesse (IX)        | 12 meses                  |
| AuditLog                 | Obrigação legal / segurança    | 5 anos                    |
| ConsentRecord            | Comprovação de consentimento   | Permanente                |
| Webhook payloads         | Execução de contrato           | 2 anos                    |
| Dados Echotik (trends)   | Não pessoal                    | Sem restrição             |

### 6.2 Fluxo de Exclusão (Direito ao Esquecimento)

```
Usuário solicita exclusão
  │
  ├─ Cria DataErasureRequest(PENDING)
  ├─ AuditLog: DATA_ERASURE_REQUESTED
  │
  ├─ Admin analisa
  │     ├─ Verifica obrigações legais de retenção
  │     ├─ Verifica subscription ativa (cancela primeiro se necessário)
  │
  ├─ Processamento (IN_PROGRESS):
  │     ├─ Anonimiza User: email→"deleted_XXX@anon", name→null, passwordHash→null
  │     ├─ Deleta: SavedItem, CollectionItem, Collection, Note, Alert
  │     ├─ Anonimiza: HotmartIdentity (buyerEmail→null)
  │     ├─ Mantém (com referência anonimizada): AuditLog, SubscriptionCharge
  │     ├─ User.status → INACTIVE, User.deletedAt → now()
  │     └─ AuditLog: DATA_ERASURE_COMPLETED
  │
  └─ DataErasureRequest.status → COMPLETED
```

### 6.3 Política de Retenção Automática

| Entidade            | Política             | Ação                                  |
| ------------------- | -------------------- | ------------------------------------- |
| HotmartWebhookEvent | > 2 anos e PROCESSED | Deleta payloadJson (mantém metadados) |
| UsageEvent          | > 12 meses           | Deleta                                |
| UsagePeriod         | > 24 meses           | Deleta                                |
| AuditLog            | > 5 anos             | Deleta                                |
| EchotikRawResponse  | > 6 meses            | Deleta                                |

---

## 7. Critérios de Qualidade

- [x] **Idempotência**: Webhook processing usa SHA-256 idempotency key
- [x] **Retry com backoff**: 3 tentativas com delays progressivos (500ms, 2s, 5s)
- [x] **Audit trail**: Todo evento significativo gera AuditLog
- [x] **RBAC**: Middleware + role check para rotas admin
- [x] **Soft delete**: LGPD via `deletedAt` + anonimização
- [x] **Separação de concerns**: IAM ≠ Billing ≠ Access (derivado)
- [x] **Estado nunca duplicado**: AccessStatus é computado, nunca persistido
- [x] **Type safety**: TypeScript strict, Prisma generated types

---

## 8. Checklist de Implementação

- [x] Schema: AccessGrant, ConsentRecord, DataErasureRequest, Invitation
- [x] Schema: Campos LGPD em User (lgpdConsentAt, deletedAt)
- [x] Service: `lib/access/resolver.ts` — resolução de acesso
- [x] Service: `lib/lgpd/erasure.ts` — processamento de exclusão
- [x] API: `POST /api/admin/access-grants` — concessão manual
- [x] API: `GET /api/admin/users` — listagem com filtros
- [x] API: `PATCH /api/admin/users/[id]` — alteração de status
- [x] API: `POST /api/admin/webhook-events/replay` — replay
- [x] API: `GET /api/user/access` — status de acesso do usuário logado
- [x] Middleware: check `deletedAt` em rotas protegidas
- [x] Processor: auto-suspend em PURCHASE_CHARGEBACK
