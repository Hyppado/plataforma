# Schema Review — ExternalAccountLink & AdminNotification

> Focused review of two specific schema areas. March 2026.

---

## 1. Executive Summary

Two schema areas need refinement before the model is treated as stable:

1. **`ExternalAccountLink.externalEmail`** — the `@@unique([provider, externalEmail])` constraint is **dangerous in production**. External emails are mutable, duplicatable, and untrustworthy as unique identifiers. The constraint must be downgraded to a non-unique index.

2. **`AdminNotification`** — the current model is functional but incomplete. It needs a `source` field, a proper `dedupeKey` for deterministic dedup (replacing the time-window heuristic), `readAt`/`archivedAt` timestamps, and cleanup of the resolve flow.

Both changes are safe, backward-compatible, and do not affect other tables.

---

## 2. PART 1 — Review of `ExternalAccountLink.externalEmail`

### Current State

```prisma
@@unique([provider, externalCustomerId])    // ← KEEP
@@unique([provider, externalEmail])          // ← PROBLEM
```

### The Problem

`externalEmail` is **not a reliable unique identifier** for an external provider link. Making it unique creates real production failures:

| Scenario                                         | What happens with unique constraint                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User changes email at Hotmart                    | New webhook arrives with new email → Prisma throws unique violation because old link still has old email                                                 |
| Bulk import + webhook race                       | Import creates link with email A, webhook arrives milliseconds later with same email → duplicate error                                                   |
| Hotmart sends `buyer.email` ≠ `subscriber.email` | Same person, two different email values → could create two links or fail                                                                                 |
| Admin manual link                                | Admin links user to Hotmart account → if email matches another link, fails                                                                               |
| LGPD anonymization                               | Erasure sets `externalEmail = null` → next event for same provider + null email → unique violation on `[provider, null]` if Prisma treats nulls as equal |
| Reconciliation                                   | Reconciliation flow tries to re-link a user whose email drifted → blocked by constraint                                                                  |

### Analysis

1. **Is `externalEmail` trustworthy as a unique identifier?** No. Emails change, providers send inconsistent values, and the same person can appear with different emails across events.

2. **What is `externalEmail` good for?** Matching and reconciliation. It's the best heuristic for "find the user this Hotmart event belongs to" — but it's a **lookup hint**, not an identity.

3. **What about `externalCustomerId`?** This IS reliable. Hotmart's `subscriberCode` is immutable per subscription. `[provider, externalCustomerId]` as unique is correct and safe.

### Recommendation

| Constraint                                 | Action             | Reason                                                                   |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `@@unique([provider, externalCustomerId])` | **KEEP**           | `externalCustomerId` (subscriberCode) is immutable and provider-assigned |
| `@@unique([provider, externalEmail])`      | **REMOVE → INDEX** | Email is mutable, duplicatable, untrustworthy as unique identifier       |
| `@@index([provider, externalEmail])`       | **ADD**            | Fast lookup for matching/reconciliation without blocking writes          |

### Final Schema

```prisma
model ExternalAccountLink {
  id                  String   @id @default(uuid())
  userId              String
  provider            String
  externalCustomerId  String?
  externalReference   String?
  externalEmail       String?
  linkedAt            DateTime @default(now())
  linkConfidence      String   @default("auto_email")
  linkMethod          String   @default("webhook")
  isActive            Boolean  @default(true)
  metadata            Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id])

  @@unique([provider, externalCustomerId])   // stable, provider-assigned ID
  @@index([provider, externalEmail])          // fast lookup, NOT unique
  @@index([userId])
  @@index([provider, isActive])
}
```

### Impact on Application Code

The current code already uses `findFirst` for email lookups — it never relies on the unique constraint for email-based queries. The only code path that could break is if any `create` or `upsert` uses `where: { provider_externalEmail: ... }` — reviewing the codebase confirms this is **not the case**. All email lookups use `findFirst` with `where: { provider, externalEmail }`.

The `processor.ts` `resolveOrCreateIdentity` and `import-subscribers.ts` both use `findFirst` — safe.

### Matching Logic Rules

With `externalEmail` as index-only:

1. **First match**: by `[provider, externalCustomerId]` — deterministic, immutable
2. **Fallback match**: by `[provider, externalEmail]` — heuristic, used when `externalCustomerId` is absent
3. **Confidence tracking**: `linkConfidence` already records how the link was established
4. **No blocking**: email drift, duplicates, and reconciliation are never blocked by a constraint

---

## 3. PART 2 — Fully Detailed `AdminNotification`

### Current State

The model works but has gaps:

- No `source` field (can't distinguish webhook vs cron vs system notifications)
- Dedup is time-window heuristic in application code (1h window, `type + userId + createdAt >= 1h ago`) — fragile, not deterministic
- No `readAt` / `archivedAt` timestamps (status changes lose temporal info)
- `resolvedBy` is a raw string, not a FK
- No `dedupeKey` for deterministic dedup at DB level

### Proposed Final Model

```prisma
enum NotificationSeverity {
  INFO
  WARNING
  HIGH
  CRITICAL
}

enum NotificationStatus {
  UNREAD
  READ
  ARCHIVED
}

model AdminNotification {
  id              String                @id @default(cuid())

  // Classification
  source          String                @default("hotmart")    // "hotmart" | "system" | "cron" | "reconciliation" | "import"
  type            String                                       // "SUBSCRIPTION_CANCELED" | "CHARGEBACK" | "WEBHOOK_INVALID" | "PROCESSING_FAILED" | "IMPORT_ANOMALY" | etc.
  severity        NotificationSeverity  @default(WARNING)

  // Content
  title           String
  message         String
  metadata        Json?                 // structured extras: eventType, transactionId, amounts, etc.

  // State
  status          NotificationStatus    @default(UNREAD)
  readAt          DateTime?             // when status changed to READ
  archivedAt      DateTime?             // when status changed to ARCHIVED
  resolvedAt      DateTime?             // when an admin marked it resolved
  resolvedBy      String?               // admin userId who resolved

  // Deduplication
  dedupeKey       String?   @unique     // deterministic key: SHA-256(type + userId + eventId/transactionId)
                                        // null = no dedup (always creates)

  // Relations — optional context
  userId          String?
  user            User?                 @relation(fields: [userId], references: [id], onDelete: SetNull)

  subscriptionId  String?
  subscription    Subscription?         @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  eventId         String?
  event           HotmartWebhookEvent?  @relation(fields: [eventId], references: [id], onDelete: SetNull)

  // Timestamps
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  // Indexes
  @@index([status, severity])           // admin inbox: unread + critical first
  @@index([source, createdAt])          // filter by source
  @@index([createdAt])                  // time-based queries and cleanup
  @@index([userId])                     // notifications per user
  @@index([type, createdAt])            // type-based filtering
}
```

### Field-by-Field Specification

| Field            | Type             | Required | Default      | Purpose                                                                                                                                                                                                                                                |
| ---------------- | ---------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | cuid             | yes      | auto         | PK                                                                                                                                                                                                                                                     |
| `source`         | String           | yes      | `"hotmart"`  | Origin system: `hotmart`, `system`, `cron`, `reconciliation`, `import`                                                                                                                                                                                 |
| `type`           | String           | yes      | —            | Event classification: `SUBSCRIPTION_CANCELED`, `CHARGEBACK`, `WEBHOOK_INVALID`, `PROCESSING_FAILED`, `IMPORT_ANOMALY`, `INGESTION_WARNING`, `RECONCILIATION_ANOMALY`                                                                                   |
| `severity`       | Enum             | yes      | `WARNING`    | `INFO` < `WARNING` < `HIGH` < `CRITICAL`                                                                                                                                                                                                               |
| `title`          | String           | yes      | —            | Human-readable short title for admin UI                                                                                                                                                                                                                |
| `message`        | String           | yes      | —            | Detailed description with rendered template                                                                                                                                                                                                            |
| `metadata`       | Json?            | no       | null         | Structured data: `{ eventType, transactionId, amount, planCode, ip, ... }`                                                                                                                                                                             |
| `status`         | Enum             | yes      | `UNREAD`     | `UNREAD` → `READ` → `ARCHIVED`                                                                                                                                                                                                                         |
| `readAt`         | DateTime?        | no       | null         | Set when status transitions to `READ`                                                                                                                                                                                                                  |
| `archivedAt`     | DateTime?        | no       | null         | Set when status transitions to `ARCHIVED`                                                                                                                                                                                                              |
| `resolvedAt`     | DateTime?        | no       | null         | Set when admin explicitly resolves (can be different from archive)                                                                                                                                                                                     |
| `resolvedBy`     | String?          | no       | null         | Admin `userId` who resolved. Not a FK to avoid cascade complexity — admin identity is validated at API level                                                                                                                                           |
| `dedupeKey`      | String? (unique) | no       | null         | Deterministic dedup key. When non-null, prevents duplicate notifications for the same event. Format: `SHA-256(type + ":" + (eventId \|\| transactionId \|\| userId) + ":" + context)`. Null means "always create" (used by `createDirectNotification`) |
| `userId`         | String? (FK)     | no       | null         | Related user. `onDelete: SetNull` — notification survives user deletion                                                                                                                                                                                |
| `subscriptionId` | String? (FK)     | no       | null         | Related subscription. `onDelete: SetNull`                                                                                                                                                                                                              |
| `eventId`        | String? (FK)     | no       | null         | Related webhook event. `onDelete: SetNull`                                                                                                                                                                                                             |
| `createdAt`      | DateTime         | yes      | `now()`      | Immutable                                                                                                                                                                                                                                              |
| `updatedAt`      | DateTime         | yes      | `@updatedAt` | Last mutation                                                                                                                                                                                                                                          |

### Deduplication Strategy

**Current approach** (time-window heuristic):

```ts
// Fragile: depends on timing, race conditions possible
const existing = await prisma.adminNotification.findFirst({
  where: { type, userId, createdAt: { gte: dedupSince } },
});
```

**Proposed approach** (deterministic key):

```ts
import { createHash } from "crypto";

function buildDedupeKey(
  type: string,
  ...parts: (string | null | undefined)[]
): string {
  const material = [type, ...parts.filter(Boolean)].join(":");
  return createHash("sha256").update(material).digest("hex");
}

// Usage in createNotificationIfNeeded:
const dedupeKey = buildDedupeKey(
  notificationType,
  ctx.eventId ?? ctx.transactionId,
  ctx.userId,
);
```

Rules:

- **Webhook-originated**: `dedupeKey = hash(type + eventId)` — one notification per webhook event
- **User-scoped**: `dedupeKey = hash(type + userId + date)` — one per user per day (for recurring warnings)
- **Direct/system**: `dedupeKey = null` — always creates (cron reports, one-off alerts)
- **DB enforces**: `@unique` on `dedupeKey` — race-safe, no time window dependency

### Severity Model

| Level      | When to use                        | Example                                           |
| ---------- | ---------------------------------- | ------------------------------------------------- |
| `INFO`     | Operational data, no action needed | "Import completed: 12 subscribers"                |
| `WARNING`  | Attention advisable, not urgent    | Subscription canceled, payment delayed            |
| `HIGH`     | Action required soon               | Refund processed, processing failed after retries |
| `CRITICAL` | Immediate attention                | Chargeback, invalid webhook signature (security)  |

### Status Lifecycle

```
UNREAD → READ → ARCHIVED
         ↓
      (resolvedAt + resolvedBy set independently of status)
```

- `UNREAD`: new notification, badge count in admin UI
- `READ`: admin has seen it, still visible in inbox
- `ARCHIVED`: removed from active view, eligible for cleanup by reconciliation cron
- `resolvedAt`/`resolvedBy`: can be set on any status — represents "admin acknowledged and took action"

### Relationship Boundaries

| Relation              | Cardinality  | onDelete | Rationale                                         |
| --------------------- | ------------ | -------- | ------------------------------------------------- |
| `User`                | N:1 optional | SetNull  | Notification survives user deletion/anonymization |
| `Subscription`        | N:1 optional | SetNull  | Notification survives subscription cleanup        |
| `HotmartWebhookEvent` | N:1 optional | SetNull  | Notification is independent of raw event storage  |

Important: `AdminNotification` is the **admin-facing record**. `HotmartWebhookEvent` is the **raw event storage**. `Subscription.status` is the **processing state**. These three are distinct concerns and must not be conflated.

### Notification Types (reference values)

| Type                        | Source         | Severity | Trigger                                        |
| --------------------------- | -------------- | -------- | ---------------------------------------------- |
| `SUBSCRIPTION_CANCELED`     | hotmart        | WARNING  | Webhook: PURCHASE_CANCELED                     |
| `SUBSCRIPTION_CANCELLATION` | hotmart        | WARNING  | Webhook: SUBSCRIPTION_CANCELLATION             |
| `SUBSCRIPTION_REFUNDED`     | hotmart        | HIGH     | Webhook: PURCHASE_REFUNDED                     |
| `SUBSCRIPTION_CHARGEBACK`   | hotmart        | CRITICAL | Webhook: PURCHASE_CHARGEBACK                   |
| `SUBSCRIPTION_DELAYED`      | hotmart        | WARNING  | Webhook: PURCHASE_DELAYED                      |
| `WEBHOOK_INVALID`           | hotmart        | CRITICAL | Invalid HOTTOK signature                       |
| `PROCESSING_FAILED`         | hotmart        | HIGH     | Event processing failed after retries          |
| `IDENTITY_UNRESOLVED`       | hotmart        | WARNING  | Could not resolve user identity                |
| `RECONCILIATION_ANOMALY`    | reconciliation | WARNING  | Stale subscriptions or data drift detected     |
| `IMPORT_ANOMALY`            | import         | WARNING  | Subscriber import had errors                   |
| `INGESTION_WARNING`         | cron           | WARNING  | Echotik ingestion failures or excessive errors |

---

## 4. Risks and Trade-offs

### ExternalAccountLink

| Risk                                                                         | Mitigation                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removing unique on email could allow duplicate links for same provider+email | Application code already uses `findFirst` — duplicates are harmless and can be cleaned up. The alternative (unique constraint) blocks valid operations                                                     |
| Email drift creates orphaned links                                           | Reconciliation flow can detect and merge links with different emails for same `externalCustomerId`                                                                                                         |
| `externalCustomerId` could be null                                           | Constraint is `@@unique([provider, externalCustomerId])` — Prisma treats null as non-matching in unique, so multiple null entries are allowed. This is correct: links without a customer ID don't conflict |

### AdminNotification

| Risk                                                                         | Mitigation                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `dedupeKey` migration: existing notifications have no key                    | Allow null — existing records are unaffected. Only new notifications get dedup keys                                                   |
| `dedupeKey` SHA-256 collision                                                | Astronomically unlikely. 256-bit hash space is sufficient                                                                             |
| `resolvedBy` is not a FK                                                     | Intentional: avoids cascade complexity, admin identity validated at API level. If admin user is deleted, the string remains for audit |
| `source` field added: existing records have no source                        | Default `"hotmart"` covers 99% of existing notifications. Safe migration                                                              |
| `readAt`/`archivedAt` added: existing archived records won't have timestamps | Acceptable: only future state changes will populate these. Historical data remains with `status` only                                 |

---

## 5. Final Recommendation

### ExternalAccountLink

**Change `@@unique([provider, externalEmail])` → `@@index([provider, externalEmail])`.**

This is the single safest change. It unblocks email drift, reconciliation, imports, and LGPD anonymization without any loss of functionality. The unique constraint on `[provider, externalCustomerId]` remains as the true identity anchor.

### AdminNotification

**Add `source`, `dedupeKey`, `readAt`, `archivedAt` fields. Update application code to use deterministic dedup keys.**

The time-window dedup heuristic should be replaced with `dedupeKey` for production reliability. The `source` field enables proper filtering in the admin inbox. Timestamp fields enable proper lifecycle tracking.

Both changes are backward-compatible, non-destructive, and can be applied with `prisma db push` without data loss.
