# Code Generation Plan — notification-reset-on-open

## Unit Context
- **Stories implemented**: Badge auto-resets to 0 on bell click; all UNREAD → READ in DB; "mark all" button removed; error revert on API failure
- **Dependencies**: Existing `PATCH /api/admin/notifications`, `requireAdmin()`, `createLogger`, Prisma, SWR, MUI
- **PBT framework**: `fast-check` (install as dev dependency)

---

## Steps

- [ ] **Step 1 — Install fast-check dev dependency**
  - Run `npm install -D fast-check` in the project root
  - Verify it appears in `package.json` devDependencies

- [ ] **Step 2 — Modify `app/api/admin/notifications/route.ts` (PATCH handler)**
  - Add `markAll?: boolean` to the request body type
  - Add a `markAll` branch: when `markAll === true && status === "READ"`, run `prisma.adminNotification.updateMany({ where: { status: "UNREAD" }, data: { status: "READ", readAt: now } })`
  - Validate: reject `markAll` with any status other than `"READ"` (400)
  - Add structured log: `notifLog.info({ adminId, updated: result.count }, "mark-all-read")`
  - Return `{ updated: result.count }` (same shape as existing bulk response)
  - Security: `requireAdmin()` guard already present — no change needed (SECURITY-08 ✓)
  - Error handling: existing `catch` block covers this path (SECURITY-15 ✓)

- [ ] **Step 3 — Modify `app/components/layout/HeaderNotifications.tsx`**
  - Extract bell-click handler into `handleOpen` callback
  - On open: if `unreadCount > 0`, immediately call `mutateSummary({ unread: 0, critical: 0, total: summary?.total ?? 0 }, false)` (optimistic zero)
  - Then call `fetch("PATCH /api/admin/notifications", { markAll: true, status: "READ" })`
  - On fetch failure: call `mutateSummary()` (revert — re-fetches true count) (RESILIENCY-10 ✓)
  - Remove `handleMarkAllRead` callback entirely
  - Remove the checkmark `IconButton` ("Marcar todas como lidas") from the popover header
  - Remove the `Tooltip` wrapper around that button
  - Remove `CheckCircleOutline` from icon imports (no longer used)

- [ ] **Step 4 — Add unit tests for `markAll` to `__tests__/api/admin/notifications.test.ts`**
  - `it("marks all UNREAD as READ when markAll: true")` — mock `updateMany`, assert called with `where: { status: "UNREAD" }` and `data: { status: "READ", readAt: expect.any(Date) }`
  - `it("returns 400 when markAll: true but status is not READ")`
  - `it("returns 403 for non-admin when markAll: true")` — use `mockUnauthenticated()`
  - `it("does not enter markAll branch when markAll is absent")` — existing bulk path unchanged

- [ ] **Step 5 — Add PBT tests (idempotency + invariant)**
  - Add a new `describe("markAll PBT", ...)` block in `__tests__/api/admin/notifications.test.ts`
  - **PBT-04 Idempotency**: Use `fast-check` `fc.integer({ min: 0, max: 100 })` to generate a random unread count; mock `updateMany` to return `{ count: n }`; assert calling the handler twice leaves the same observable state (second call with `where: { status: "UNREAD" }` returns `{ count: 0 }` because none are unread anymore)
  - **PBT-03 Invariant**: After `markAll` executes, `prisma.adminNotification.count({ where: { status: "UNREAD" } })` would return 0 — verify the handler response always has `updated >= 0` and the Prisma call always uses `where: { status: "UNREAD" }` regardless of generated input
  - Use `fc.assert(fc.asyncProperty(...))` with Vitest

---

## Completion Criteria
- [ ] All 5 steps marked [x]
- [ ] `npm run test` passes (zero regressions)
- [ ] `npx tsc --noEmit` passes
