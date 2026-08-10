/**
 * Derived "effective account state" for admin user management.
 *
 * The raw `User.status` field (ACTIVE/INACTIVE/SUSPENDED) does NOT reflect
 * whether a user actually has access: a user can be ACTIVE but have a
 * cancelled/expired/refunded subscription and therefore no access.
 *
 * This module computes a single, direct state that combines:
 *   - User.status (admin deactivation / suspension)
 *   - the primary Subscription status + paid-through date
 *   - the latest charge status (refund / chargeback detection)
 *   - active admin AccessGrant (courtesy access)
 *
 * It is a PURE function over already-fetched data (no DB access) so it can be
 * reused on the server (API enrichment + aggregation) and unit-tested in
 * isolation. It mirrors the priority order of lib/access/resolver.ts.
 */

export type AccountState =
  | "ACTIVE" // has access via active paid subscription
  | "COURTESY" // has access via active admin grant (no paid sub)
  | "PAST_DUE" // inadimplente — grace period, still has access
  | "CANCELLING" // cancelled/expired but still within the paid period
  | "REFUNDED" // last charge refunded/chargeback — no access
  | "CANCELLED" // subscription cancelled — no access
  | "EXPIRED" // subscription expired — no access
  | "INACTIVE" // deactivated by admin — no access
  | "SUSPENDED" // suspended by admin/chargeback — no access
  | "NO_ACCESS"; // never had access (no sub, no grant)

export interface AccountStateInput {
  userStatus: string; // ACTIVE | INACTIVE | SUSPENDED
  subscriptionStatus: string | null;
  subscriptionEndedAt: Date | string | null;
  latestChargeStatus: string | null;
  hasActiveGrant: boolean;
}

// REFUND_REQUEST entra aqui junto dos confirmados: o pedido de reembolso já
// revoga o acesso (ver IMMEDIATE_REVOCATION_EVENTS no processor da Hotmart),
// então o painel precisa refletir isso em vez de mostrar a conta como ativa.
const REFUND_CHARGE_STATUSES = new Set([
  "REFUND_REQUEST",
  "REFUNDED",
  "CHARGEBACK",
]);

/** States in which the user currently has access to the product. */
const ACCESS_STATES = new Set<AccountState>([
  "ACTIVE",
  "COURTESY",
  "PAST_DUE",
  "CANCELLING",
]);

export function deriveAccountState(input: AccountStateInput): AccountState {
  const {
    userStatus,
    subscriptionStatus,
    subscriptionEndedAt,
    latestChargeStatus,
    hasActiveGrant,
  } = input;

  // Admin-controlled blocks take precedence — no access regardless of billing.
  if (userStatus === "SUSPENDED") return "SUSPENDED";
  if (userStatus === "INACTIVE") return "INACTIVE";

  // Access-granting states, in priority order.
  if (subscriptionStatus === "ACTIVE") return "ACTIVE";
  if (hasActiveGrant) return "COURTESY";
  if (subscriptionStatus === "PAST_DUE") return "PAST_DUE";

  const endedAt = subscriptionEndedAt ? new Date(subscriptionEndedAt) : null;
  const stillWithinPaidPeriod =
    endedAt != null && endedAt.getTime() > Date.now();
  if (
    (subscriptionStatus === "CANCELLED" || subscriptionStatus === "EXPIRED") &&
    stillWithinPaidPeriod
  ) {
    return "CANCELLING";
  }

  // Access-loss states.
  if (latestChargeStatus && REFUND_CHARGE_STATUSES.has(latestChargeStatus)) {
    return "REFUNDED";
  }
  if (subscriptionStatus === "CANCELLED") return "CANCELLED";
  if (subscriptionStatus === "EXPIRED") return "EXPIRED";

  return "NO_ACCESS";
}

export function accountHasAccess(state: AccountState): boolean {
  return ACCESS_STATES.has(state);
}

/** Portuguese labels for the effective account state. */
export const ACCOUNT_STATE_LABEL: Record<AccountState, string> = {
  ACTIVE: "Ativo",
  COURTESY: "Cortesia",
  PAST_DUE: "Inadimplente",
  CANCELLING: "Cancelado (em vigor)",
  REFUNDED: "Reembolsado",
  CANCELLED: "Sem acesso (cancelado)",
  EXPIRED: "Sem acesso (expirado)",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
  NO_ACCESS: "Sem acesso",
};

// ---------------------------------------------------------------------------
// Account TYPE — "who the account is" (orthogonal to access situation)
// ---------------------------------------------------------------------------
// The type answers "what kind of account is this", independent of whether they
// currently have access. A paid subscription ALWAYS wins over a courtesy grant:
// an admin-created (courtesy) user who later subscribes becomes a "subscriber".

export type AccountType =
  | "admin" // role ADMIN
  | "subscriber" // has (or had) a commercial subscription
  | "courtesy" // admin-granted access only (no subscription)
  | "lead"; // registered, never had subscription nor grant

export interface AccountTypeInput {
  role: string; // ADMIN | USER
  hasSubscription: boolean; // any Subscription row exists
  hasActiveGrant: boolean; // an active, non-expired AccessGrant exists
}

export function deriveAccountType(input: AccountTypeInput): AccountType {
  if (input.role === "ADMIN") return "admin";
  // A paid subscription defines the type even if a legacy courtesy grant lingers.
  if (input.hasSubscription) return "subscriber";
  if (input.hasActiveGrant) return "courtesy";
  return "lead";
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  admin: "Admin",
  subscriber: "Assinante",
  courtesy: "Cortesia",
  lead: "Cadastro",
};

export type AccountTypeFilter = "all" | AccountType;

const ACCOUNT_TYPE_FILTERS: AccountTypeFilter[] = [
  "all",
  "admin",
  "subscriber",
  "courtesy",
  "lead",
];

export function isAccountTypeFilter(
  value: string | null,
): value is AccountTypeFilter {
  return value != null && (ACCOUNT_TYPE_FILTERS as string[]).includes(value);
}

export function matchesTypeFilter(
  filter: AccountTypeFilter,
  type: AccountType,
): boolean {
  return filter === "all" || filter === type;
}

// ---------------------------------------------------------------------------
// Access filter groups — "current access situation" (the badge in the table)
// ---------------------------------------------------------------------------
// These describe ONLY the access state, never the type. Used by the access
// dropdown and the quick chips (Com acesso / Sem acesso / Inadimplente).

export type AccountFilterGroup =
  | "all"
  | "with_access" // any state that currently grants access
  | "active" // ACTIVE
  | "courtesy" // COURTESY (access via grant)
  | "past_due" // PAST_DUE (inadimplente)
  | "cancelling" // CANCELLING (cancelled but still in paid period)
  | "refunded" // REFUNDED
  | "cancelled" // CANCELLED (no access)
  | "expired" // EXPIRED (no access)
  | "no_access" // any state without access
  | "inactive" // INACTIVE
  | "suspended"; // SUSPENDED

export function matchesFilterGroup(
  group: AccountFilterGroup,
  state: AccountState,
): boolean {
  switch (group) {
    case "all":
      return true;
    case "with_access":
      return accountHasAccess(state);
    case "active":
      return state === "ACTIVE";
    case "courtesy":
      return state === "COURTESY";
    case "past_due":
      return state === "PAST_DUE";
    case "cancelling":
      return state === "CANCELLING";
    case "refunded":
      return state === "REFUNDED";
    case "cancelled":
      return state === "CANCELLED";
    case "expired":
      return state === "EXPIRED";
    case "no_access":
      return !accountHasAccess(state);
    case "inactive":
      return state === "INACTIVE";
    case "suspended":
      return state === "SUSPENDED";
    default:
      return true;
  }
}

export const ACCOUNT_FILTER_GROUPS: AccountFilterGroup[] = [
  "all",
  "with_access",
  "active",
  "courtesy",
  "past_due",
  "cancelling",
  "refunded",
  "cancelled",
  "expired",
  "no_access",
  "inactive",
  "suspended",
];

export function isAccountFilterGroup(
  value: string | null,
): value is AccountFilterGroup {
  return value != null && (ACCOUNT_FILTER_GROUPS as string[]).includes(value);
}
