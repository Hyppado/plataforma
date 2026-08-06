# Execution Plan — Notification Badge Auto-Reset on Bell Click

## Detailed Analysis Summary

### Transformation Type
Single component change — modifications to one API route and one React component.

### Change Impact Assessment
- **User-facing changes**: Yes — the badge drops to 0 on bell click; "mark all" button removed from popover
- **Structural changes**: No — no new components, no new routes
- **Data model changes**: No — existing `AdminNotification.status` field used as-is
- **API changes**: Yes (additive only) — `PATCH /api/admin/notifications` gains `markAll: true` support; fully backward-compatible
- **NFR impact**: Low — error handling, auth guard, structured logging, PBT required

### Risk Assessment
- **Risk Level**: Low — isolated change, easy rollback (revert two files), well-understood codebase
- **Rollback Complexity**: Easy — revert `route.ts` and `HeaderNotifications.tsx`
- **Testing Complexity**: Simple — existing test helpers cover the pattern

---

## Workflow Visualization

```
INCEPTION PHASE
  [x] Workspace Detection     — COMPLETED
  [x] Reverse Engineering     — COMPLETED
  [x] Requirements Analysis   — COMPLETED
  [ ] User Stories            — SKIP (no new persona, simple single-actor change)
  [x] Workflow Planning       — IN PROGRESS
  [ ] Application Design      — SKIP (changes within existing component boundaries)
  [ ] Units Generation        — SKIP (single unit, no decomposition needed)

CONSTRUCTION PHASE
  [ ] Functional Design       — SKIP (no complex new business logic; logic is trivial)
  [ ] NFR Requirements        — SKIP (NFRs captured in requirements.md)
  [ ] NFR Design              — SKIP (no new patterns or infrastructure)
  [ ] Infrastructure Design   — SKIP (no infrastructure changes)
  [→] Code Generation         — EXECUTE (single unit: notification-reset-on-open)
  [→] Build and Test          — EXECUTE

OPERATIONS PHASE
  [ ] Operations              — PLACEHOLDER
```

---

## Phases to Execute

### INCEPTION PHASE
- [x] Workspace Detection (COMPLETED)
- [x] Reverse Engineering (COMPLETED)
- [x] Requirements Analysis (COMPLETED)
- [x] Workflow Planning (IN PROGRESS)
- [ ] User Stories — **SKIP**: No multiple personas, no acceptance criteria ambiguity. Single admin-facing UX tweak.
- [ ] Application Design — **SKIP**: No new components or service methods being created.
- [ ] Units Generation — **SKIP**: Single unit with two files; no decomposition adds value.

### CONSTRUCTION PHASE
- [ ] Functional Design — **SKIP**: Business logic is trivial (one Prisma `updateMany` + optimistic UI update).
- [ ] NFR Requirements — **SKIP**: NFR constraints already captured in requirements.md.
- [ ] NFR Design — **SKIP**: No new resiliency patterns or infra to design.
- [ ] Infrastructure Design — **SKIP**: No infrastructure changes.
- [ ] **Code Generation — EXECUTE**: Unit `notification-reset-on-open`
- [ ] **Build and Test — EXECUTE**

### OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

---

## Package Change Sequence

Single package (Next.js monolith). Sequence:

1. `app/api/admin/notifications/route.ts` — add `markAll` to PATCH (backend first; tested independently)
2. `app/components/layout/HeaderNotifications.tsx` — consume new `markAll` endpoint on bell click
3. `__tests__/api/admin/notifications.test.ts` — add unit tests for `markAll` path
4. PBT tests — idempotency + zero-unread invariant (new describe block in existing test file or sibling)

Optional (PBT-09):
- `npm install -D fast-check` — add PBT framework

---

## Success Criteria
- **Primary Goal**: Badge drops to 0 on bell click; all UNREAD notifications become READ in DB
- **Key Deliverables**: 2 modified source files + expanded test suite
- **Quality Gates**:
  - `PATCH` with `markAll: true` returns 200 with updated count
  - `PATCH` with `markAll: true` and non-ADMIN caller returns 403
  - Frontend bell click triggers `markAll` and optimistically zeros badge
  - On API failure, badge count is restored via `mutateSummary()`
  - PBT: idempotency holds; unread count = 0 after `markAll`
  - All existing tests still pass (`npm run test`)
