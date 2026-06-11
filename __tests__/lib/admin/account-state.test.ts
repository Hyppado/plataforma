/**
 * Tests: lib/admin/account-state.ts — derived effective account state
 */
import { describe, it, expect } from "vitest";
import {
  deriveAccountState,
  deriveAccountType,
  accountHasAccess,
  matchesFilterGroup,
  matchesTypeFilter,
  type AccountStateInput,
} from "@/lib/admin/account-state";

function input(overrides: Partial<AccountStateInput> = {}): AccountStateInput {
  return {
    userStatus: "ACTIVE",
    subscriptionStatus: null,
    subscriptionEndedAt: null,
    latestChargeStatus: null,
    hasActiveGrant: false,
    ...overrides,
  };
}

describe("deriveAccountState", () => {
  it("SUSPENDED user status overrides everything", () => {
    expect(
      deriveAccountState(
        input({ userStatus: "SUSPENDED", subscriptionStatus: "ACTIVE" }),
      ),
    ).toBe("SUSPENDED");
  });

  it("INACTIVE user status overrides active subscription", () => {
    expect(
      deriveAccountState(
        input({ userStatus: "INACTIVE", subscriptionStatus: "ACTIVE" }),
      ),
    ).toBe("INACTIVE");
  });

  it("active subscription = ACTIVE", () => {
    expect(deriveAccountState(input({ subscriptionStatus: "ACTIVE" }))).toBe(
      "ACTIVE",
    );
  });

  it("active grant without paid sub = COURTESY", () => {
    expect(deriveAccountState(input({ hasActiveGrant: true }))).toBe(
      "COURTESY",
    );
  });

  it("active subscription takes precedence over grant", () => {
    expect(
      deriveAccountState(
        input({ subscriptionStatus: "ACTIVE", hasActiveGrant: true }),
      ),
    ).toBe("ACTIVE");
  });

  it("past due = PAST_DUE", () => {
    expect(deriveAccountState(input({ subscriptionStatus: "PAST_DUE" }))).toBe(
      "PAST_DUE",
    );
  });

  it("cancelled but still within paid period = CANCELLING", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(
      deriveAccountState(
        input({ subscriptionStatus: "CANCELLED", subscriptionEndedAt: future }),
      ),
    ).toBe("CANCELLING");
  });

  it("cancelled with past end date = CANCELLED", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(
      deriveAccountState(
        input({ subscriptionStatus: "CANCELLED", subscriptionEndedAt: past }),
      ),
    ).toBe("CANCELLED");
  });

  it("refunded charge = REFUNDED", () => {
    expect(
      deriveAccountState(
        input({
          subscriptionStatus: "CANCELLED",
          latestChargeStatus: "REFUNDED",
        }),
      ),
    ).toBe("REFUNDED");
  });

  it("chargeback charge = REFUNDED", () => {
    expect(
      deriveAccountState(
        input({
          subscriptionStatus: "EXPIRED",
          latestChargeStatus: "CHARGEBACK",
        }),
      ),
    ).toBe("REFUNDED");
  });

  it("expired subscription = EXPIRED", () => {
    expect(deriveAccountState(input({ subscriptionStatus: "EXPIRED" }))).toBe(
      "EXPIRED",
    );
  });

  it("no subscription, no grant = NO_ACCESS", () => {
    expect(deriveAccountState(input())).toBe("NO_ACCESS");
  });
});

describe("accountHasAccess", () => {
  it("grants access for active states", () => {
    expect(accountHasAccess("ACTIVE")).toBe(true);
    expect(accountHasAccess("COURTESY")).toBe(true);
    expect(accountHasAccess("PAST_DUE")).toBe(true);
    expect(accountHasAccess("CANCELLING")).toBe(true);
  });

  it("denies access for loss states", () => {
    expect(accountHasAccess("CANCELLED")).toBe(false);
    expect(accountHasAccess("EXPIRED")).toBe(false);
    expect(accountHasAccess("REFUNDED")).toBe(false);
    expect(accountHasAccess("INACTIVE")).toBe(false);
    expect(accountHasAccess("SUSPENDED")).toBe(false);
    expect(accountHasAccess("NO_ACCESS")).toBe(false);
  });
});

describe("matchesFilterGroup", () => {
  it("'all' matches any state", () => {
    expect(matchesFilterGroup("all", "NO_ACCESS")).toBe(true);
  });

  it("'with_access' matches access states", () => {
    expect(matchesFilterGroup("with_access", "ACTIVE")).toBe(true);
    expect(matchesFilterGroup("with_access", "COURTESY")).toBe(true);
    expect(matchesFilterGroup("with_access", "EXPIRED")).toBe(false);
  });

  it("'active' matches only ACTIVE", () => {
    expect(matchesFilterGroup("active", "ACTIVE")).toBe(true);
    expect(matchesFilterGroup("active", "CANCELLING")).toBe(false);
  });

  it("'courtesy' matches only COURTESY", () => {
    expect(matchesFilterGroup("courtesy", "COURTESY")).toBe(true);
    expect(matchesFilterGroup("courtesy", "ACTIVE")).toBe(false);
  });

  it("'past_due' matches only PAST_DUE", () => {
    expect(matchesFilterGroup("past_due", "PAST_DUE")).toBe(true);
    expect(matchesFilterGroup("past_due", "ACTIVE")).toBe(false);
  });

  it("'no_access' includes CANCELLED, EXPIRED, NO_ACCESS, REFUNDED", () => {
    expect(matchesFilterGroup("no_access", "CANCELLED")).toBe(true);
    expect(matchesFilterGroup("no_access", "EXPIRED")).toBe(true);
    expect(matchesFilterGroup("no_access", "NO_ACCESS")).toBe(true);
    expect(matchesFilterGroup("no_access", "REFUNDED")).toBe(true);
    expect(matchesFilterGroup("no_access", "ACTIVE")).toBe(false);
  });

  it("'inactive' / 'suspended' match their own states", () => {
    expect(matchesFilterGroup("inactive", "INACTIVE")).toBe(true);
    expect(matchesFilterGroup("suspended", "SUSPENDED")).toBe(true);
    expect(matchesFilterGroup("inactive", "SUSPENDED")).toBe(false);
  });
});

describe("deriveAccountType", () => {
  it("ADMIN role = admin", () => {
    expect(
      deriveAccountType({
        role: "ADMIN",
        hasSubscription: false,
        hasActiveGrant: false,
      }),
    ).toBe("admin");
  });

  it("subscription = subscriber", () => {
    expect(
      deriveAccountType({
        role: "USER",
        hasSubscription: true,
        hasActiveGrant: false,
      }),
    ).toBe("subscriber");
  });

  it("paid subscription wins over a lingering grant", () => {
    expect(
      deriveAccountType({
        role: "USER",
        hasSubscription: true,
        hasActiveGrant: true,
      }),
    ).toBe("subscriber");
  });

  it("active grant without subscription = courtesy", () => {
    expect(
      deriveAccountType({
        role: "USER",
        hasSubscription: false,
        hasActiveGrant: true,
      }),
    ).toBe("courtesy");
  });

  it("no subscription, no grant = lead", () => {
    expect(
      deriveAccountType({
        role: "USER",
        hasSubscription: false,
        hasActiveGrant: false,
      }),
    ).toBe("lead");
  });
});

describe("matchesTypeFilter", () => {
  it("'all' matches any type", () => {
    expect(matchesTypeFilter("all", "subscriber")).toBe(true);
    expect(matchesTypeFilter("all", "lead")).toBe(true);
  });

  it("specific filter matches only that type", () => {
    expect(matchesTypeFilter("courtesy", "courtesy")).toBe(true);
    expect(matchesTypeFilter("courtesy", "subscriber")).toBe(false);
  });
});
