# Requirements — Notification Badge Auto-Reset on Bell Click

## Intent Analysis

- **User Request**: When the notification bell icon is clicked, the unread badge count should reset to 0, then accumulate again from new notifications received after that click
- **Request Type**: Enhancement — improving existing feature
- **Scope**: Single component (`HeaderNotifications.tsx` + `PATCH /api/admin/notifications`)
- **Complexity**: Simple

---

## Functional Requirements

### FR-01: Mark All UNREAD as READ on Bell Click
When the admin clicks the notification bell icon (before or upon the popover opening), all notifications with status `UNREAD` MUST be transitioned to status `READ` in the database.

### FR-02: Optimistic Badge Reset
The unread badge counter MUST drop to `0` immediately on click — before the API call completes — so the UI feels instant.

### FR-03: Recount from New Notifications Only
After the bell click, only notifications created AFTER that moment (arriving via the 30-second SWR poll) will increment the badge counter again.

### FR-04: Remove Redundant "Mark All Read" Button
The checkmark icon button ("Marcar todas como lidas") inside the popover header MUST be removed, as clicking the bell already performs the same action.

### FR-05: Backend Bulk Mark-All Endpoint
The existing `PATCH /api/admin/notifications` endpoint MUST be extended to support a `markAll: true` flag that runs `updateMany({ where: { status: "UNREAD" } })` without requiring the caller to supply an array of IDs.

### FR-06: Error Resilience
If the mark-all API call fails, the frontend MUST revert the optimistic badge update (restore the previous count) so the admin is not left with a misleading zero count.

---

## Non-Functional Requirements

### NFR-01: Security — Input Validation (SECURITY-05)
The `markAll` flag in `PATCH /api/admin/notifications` must be strictly validated:
- Only `{ markAll: true, status: "READ" }` is a valid mark-all payload
- `markAll: false` or any non-boolean type must be rejected with 400
- When `markAll` is present, the `ids` array field must be ignored

### NFR-02: Security — Admin-Only Authorization (SECURITY-08)
The mark-all path uses the same `requireAdmin()` guard already on the endpoint. No relaxation permitted.

### NFR-03: Security — Audit Trail (SECURITY-13)
The bulk mark-all action should use the existing logger (`createLogger("notifications")`) to emit a structured log entry: actor admin ID + count of records updated. This provides an auditable record of who cleared the inbox.

### NFR-04: Security — Error Handling (SECURITY-15)
All error paths in the modified API endpoint MUST return a generic error message (no stack traces or DB details). Frontend MUST handle the case where the API returns a non-2xx response.

### NFR-05: Resiliency — Graceful Degradation (RESILIENCY-10)
If the `markAll` network call fails, the frontend MUST NOT crash or leave the UI in a broken state. The optimistic update MUST be reverted using `mutateSummary()` to re-fetch the true count from the server.

### NFR-06: Property-Based Testing — Idempotency (PBT-04)
The mark-all operation MUST be idempotent: calling it twice produces the same outcome as calling it once. A property-based test MUST verify this using `fast-check`.

### NFR-07: Property-Based Testing — Invariant (PBT-03)
After mark-all is called, the count of UNREAD notifications MUST equal 0, regardless of how many were unread before. A property-based test MUST verify this invariant.

### NFR-08: Property-Based Testing — Framework (PBT-09)
The PBT framework for this project is `fast-check` (Vitest integration). It is already available as a dev dependency or can be added. Tests run in the existing `vitest` runner.

---

## Extension Compliance Configuration

| Extension | Enabled | Notes |
|---|---|---|
| Security Baseline | Yes | SECURITY-01,02,04,06,07,09,10,11,12,14 → N/A for this change. SECURITY-03,05,08,13,15 → Applicable. |
| Resiliency Baseline | Yes | Most rules N/A (infrastructure unchanged). RESILIENCY-10 (graceful degradation) → Applicable. RESILIENCY-03,04 → Compliant via existing GitHub Actions + Vercel pipeline. |
| Property-Based Testing | Yes | PBT-02,05,06 → N/A for this change. PBT-01,03,04,07,08,09,10 → Applicable. Framework: fast-check. |

---

## Affected Files

| File | Change |
|---|---|
| `app/api/admin/notifications/route.ts` | Add `markAll` support to `PATCH` handler |
| `app/components/layout/HeaderNotifications.tsx` | Auto-mark-all on open, remove "mark all" button, add error revert |
| `__tests__/api/admin/notifications.test.ts` | Add unit tests for `markAll` path |
| `__tests__/lib/admin/notifications.test.ts` | Add PBT for idempotency + invariant (or add new PBT file) |
