/**
 * Tests: lib/admin/template.ts
 *
 * Coverage: renderTemplate, findMissingRequiredVariables
 */
import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  findMissingRequiredVariables,
} from "@/lib/admin/template";

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------

describe("renderTemplate()", () => {
  it("returns the template unchanged when there are no placeholders", () => {
    expect(renderTemplate("Hello world", {})).toBe("Hello world");
  });

  it("substitutes a single variable", () => {
    expect(renderTemplate("Hi {{name}}, welcome!", { name: "Ana" })).toBe(
      "Hi Ana, welcome!",
    );
  });

  it("substitutes multiple different variables", () => {
    const tpl =
      "Product: {{product_name}} | Style: {{style_label}} | Parts: {{total}}";
    const result = renderTemplate(tpl, {
      product_name: "Creme X",
      style_label: "UGC",
      total: "4",
    });
    expect(result).toBe("Product: Creme X | Style: UGC | Parts: 4");
  });

  it("replaces all occurrences of the same variable", () => {
    const result = renderTemplate("{{x}} and {{x}} again {{x}}", { x: "foo" });
    expect(result).toBe("foo and foo again foo");
  });

  it("renders empty string for variables not in the vars map", () => {
    const result = renderTemplate("Before {{missing}} after", {});
    expect(result).toBe("Before  after");
  });

  it("handles whitespace inside the placeholder braces", () => {
    const result = renderTemplate("A {{ name }} B", { name: "Carlos" });
    expect(result).toBe("A Carlos B");
  });

  it("does not replace partial matches like {name} (single braces)", () => {
    const result = renderTemplate("Hello {name}", { name: "Ana" });
    expect(result).toBe("Hello {name}");
  });

  it("handles empty template string", () => {
    expect(renderTemplate("", { name: "Ana" })).toBe("");
  });

  it("handles empty vars with template that has placeholders", () => {
    const result = renderTemplate("A {{x}} B", {});
    expect(result).toBe("A  B");
  });

  it("handles multiline templates", () => {
    const tpl = "Line 1: {{a}}\nLine 2: {{b}}\nLine 3: static";
    const result = renderTemplate(tpl, { a: "hello", b: "world" });
    expect(result).toBe("Line 1: hello\nLine 2: world\nLine 3: static");
  });

  it("substitutes variable inside a sentence without breaking surrounding text", () => {
    const result = renderTemplate(
      "SUBJECT: {{subject_block}}. PRODUCT: {{product_block}}.",
      {
        subject_block: "Ana Silva, Brazilian creator",
        product_block: "Creme Hidratante Premium",
      },
    );
    expect(result).toBe(
      "SUBJECT: Ana Silva, Brazilian creator. PRODUCT: Creme Hidratante Premium.",
    );
  });

  it("handles vars map with extra keys that are not in the template", () => {
    const result = renderTemplate("Hello {{name}}", {
      name: "Bob",
      unused_key: "ignored",
    });
    expect(result).toBe("Hello Bob");
  });
});

// ---------------------------------------------------------------------------
// findMissingRequiredVariables
// ---------------------------------------------------------------------------

describe("findMissingRequiredVariables()", () => {
  const VARS = [
    { variable: "{{name}}", required: true },
    { variable: "{{style}}", required: true },
    { variable: "{{optional}}", required: false },
  ];

  it("returns empty array when all required variables are present", () => {
    const tpl = "Hello {{name}}, style is {{style}}. Also {{optional}}.";
    expect(findMissingRequiredVariables(tpl, VARS)).toEqual([]);
  });

  it("returns missing required variable names", () => {
    const tpl = "Hello {{name}}."; // {{style}} is missing
    expect(findMissingRequiredVariables(tpl, VARS)).toEqual(["{{style}}"]);
  });

  it("returns all required vars when template is empty", () => {
    const missing = findMissingRequiredVariables("", VARS);
    expect(missing).toContain("{{name}}");
    expect(missing).toContain("{{style}}");
    expect(missing).not.toContain("{{optional}}");
  });

  it("does NOT flag optional variables as missing", () => {
    // template has required vars but not the optional one
    const tpl = "{{name}} and {{style}}";
    expect(findMissingRequiredVariables(tpl, VARS)).toEqual([]);
  });

  it("returns empty array when required list is empty", () => {
    const result = findMissingRequiredVariables("any text", []);
    expect(result).toEqual([]);
  });

  it("handles required list with only optional entries", () => {
    const optionalOnly = [{ variable: "{{opt}}", required: false }];
    const result = findMissingRequiredVariables("no vars here", optionalOnly);
    expect(result).toEqual([]);
  });

  it("is case-sensitive: {{Name}} does not match {{name}}", () => {
    const tpl = "Hello {{Name}}, style is {{style}}.";
    const missing = findMissingRequiredVariables(tpl, VARS);
    expect(missing).toContain("{{name}}"); // {{name}} (lowercase) is missing
  });

  it("detects multiple missing required variables at once", () => {
    const missing = findMissingRequiredVariables("nothing here", VARS);
    expect(missing).toHaveLength(2);
    expect(missing).toContain("{{name}}");
    expect(missing).toContain("{{style}}");
  });
});
