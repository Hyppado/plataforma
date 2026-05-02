/**
 * Tests: lib/admin/config-defaults.ts — avatar video section
 *
 * Coverage:
 *  - getDefaultAvatarVideoPrompts() shape + non-empty values
 *  - Default templates contain every required variable from their respective arrays
 *  - AVATAR_IMAGE_VARIABLES / VEO_USER_VARIABLES metadata (label, required flags)
 *  - VEO_SYSTEM_VARIABLES is intentionally empty (no dynamic vars)
 */
import { describe, it, expect } from "vitest";
import {
  getDefaultAvatarVideoPrompts,
  AVATAR_IMAGE_VARIABLES,
  VEO_SYSTEM_VARIABLES,
  VEO_USER_VARIABLES,
  getDefaultPromptConfig,
} from "@/lib/admin/config-defaults";
import { findMissingRequiredVariables } from "@/lib/admin/template";

describe("getDefaultAvatarVideoPrompts()", () => {
  it("returns an object with image, veoSystem and veoUser keys", () => {
    const defaults = getDefaultAvatarVideoPrompts();
    expect(defaults).toHaveProperty("image");
    expect(defaults).toHaveProperty("veoSystem");
    expect(defaults).toHaveProperty("veoUser");
  });

  it("all values are non-empty strings", () => {
    const { image, veoSystem, veoUser } = getDefaultAvatarVideoPrompts();
    expect(typeof image).toBe("string");
    expect(typeof veoSystem).toBe("string");
    expect(typeof veoUser).toBe("string");
    expect(image.trim().length).toBeGreaterThan(0);
    expect(veoSystem.trim().length).toBeGreaterThan(0);
    expect(veoUser.trim().length).toBeGreaterThan(0);
  });

  it("returns new objects on each call (no reference sharing)", () => {
    const a = getDefaultAvatarVideoPrompts();
    const b = getDefaultAvatarVideoPrompts();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Required variables are present in the default templates
// ---------------------------------------------------------------------------

describe("Default image template contains all required AVATAR_IMAGE_VARIABLES", () => {
  it("has zero missing required variables", () => {
    const { image } = getDefaultAvatarVideoPrompts();
    const missing = findMissingRequiredVariables(image, AVATAR_IMAGE_VARIABLES);
    expect(missing).toEqual([]);
  });
});

describe("Default veoUser template contains all required VEO_USER_VARIABLES", () => {
  it("has zero missing required variables", () => {
    const { veoUser } = getDefaultAvatarVideoPrompts();
    const missing = findMissingRequiredVariables(veoUser, VEO_USER_VARIABLES);
    expect(missing).toEqual([]);
  });
});

describe("Default veoSystem template — VEO_SYSTEM_VARIABLES is empty", () => {
  it("VEO_SYSTEM_VARIABLES has no entries (no dynamic substitution needed)", () => {
    expect(VEO_SYSTEM_VARIABLES).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Variable metadata
// ---------------------------------------------------------------------------

describe("AVATAR_IMAGE_VARIABLES metadata", () => {
  it("every entry has variable, label, description and required fields", () => {
    for (const v of AVATAR_IMAGE_VARIABLES) {
      expect(typeof v.variable).toBe("string");
      expect(typeof v.label).toBe("string");
      expect(typeof v.description).toBe("string");
      expect(typeof v.required).toBe("boolean");
      expect(v.variable).toMatch(/^\{\{[\w.-]+\}\}$/);
    }
  });

  it("has at least 5 required variables", () => {
    const required = AVATAR_IMAGE_VARIABLES.filter((v) => v.required);
    expect(required.length).toBeGreaterThanOrEqual(5);
  });

  it("subject_block, product_block, placement_block, pose, environment are required", () => {
    const required = AVATAR_IMAGE_VARIABLES.filter((v) => v.required).map(
      (v) => v.variable,
    );
    expect(required).toContain("{{subject_block}}");
    expect(required).toContain("{{product_block}}");
    expect(required).toContain("{{placement_block}}");
    expect(required).toContain("{{pose}}");
    expect(required).toContain("{{environment}}");
  });

  it("style_block and enhancements_block are optional", () => {
    const optionalVars = AVATAR_IMAGE_VARIABLES.filter((v) => !v.required).map(
      (v) => v.variable,
    );
    expect(optionalVars).toContain("{{style_block}}");
    expect(optionalVars).toContain("{{enhancements_block}}");
  });

  it("every entry has a non-empty Portuguese label", () => {
    for (const v of AVATAR_IMAGE_VARIABLES) {
      expect(v.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("no two variables share the same variable token", () => {
    const tokens = AVATAR_IMAGE_VARIABLES.map((v) => v.variable);
    const unique = new Set(tokens);
    expect(unique.size).toBe(tokens.length);
  });
});

describe("VEO_USER_VARIABLES metadata", () => {
  it("every entry has variable, label, description and required fields", () => {
    for (const v of VEO_USER_VARIABLES) {
      expect(typeof v.variable).toBe("string");
      expect(typeof v.label).toBe("string");
      expect(typeof v.description).toBe("string");
      expect(typeof v.required).toBe("boolean");
      expect(v.variable).toMatch(/^\{\{[\w.-]+\}\}$/);
    }
  });

  it("product_name, style_description, style_label, total, part_descriptions are required", () => {
    const required = VEO_USER_VARIABLES.filter((v) => v.required).map(
      (v) => v.variable,
    );
    expect(required).toContain("{{product_name}}");
    expect(required).toContain("{{style_description}}");
    expect(required).toContain("{{style_label}}");
    expect(required).toContain("{{total}}");
    expect(required).toContain("{{part_descriptions}}");
  });

  it("product_category is optional", () => {
    const opt = VEO_USER_VARIABLES.filter((v) => !v.required).map(
      (v) => v.variable,
    );
    expect(opt).toContain("{{product_category}}");
  });
});

// ---------------------------------------------------------------------------
// getDefaultPromptConfig — avatarVideo slot is always included
// ---------------------------------------------------------------------------

describe("getDefaultPromptConfig() avatarVideo slot", () => {
  it("includes an avatarVideo key", () => {
    const config = getDefaultPromptConfig();
    expect(config).toHaveProperty("avatarVideo");
  });

  it("avatarVideo has image, veoSystem, veoUser", () => {
    const { avatarVideo } = getDefaultPromptConfig();
    expect(typeof avatarVideo.image).toBe("string");
    expect(typeof avatarVideo.veoSystem).toBe("string");
    expect(typeof avatarVideo.veoUser).toBe("string");
  });

  it("avatarVideo values match getDefaultAvatarVideoPrompts()", () => {
    const config = getDefaultPromptConfig();
    const defaults = getDefaultAvatarVideoPrompts();
    expect(config.avatarVideo.image).toBe(defaults.image);
    expect(config.avatarVideo.veoSystem).toBe(defaults.veoSystem);
    expect(config.avatarVideo.veoUser).toBe(defaults.veoUser);
  });
});
