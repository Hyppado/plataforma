/**
 * lib/admin/template.ts
 *
 * Shared helpers for admin-editable prompt templates.
 *
 * Templates use {{variable}} placeholders. `renderTemplate` substitutes a
 * map of variable → string (missing variables become empty string).
 *
 * `validateRequiredVariables` checks a candidate template contains every
 * required variable — used by the API to refuse saves that would break
 * downstream prompt generation.
 */

/** Substitute every {{variable}} occurrence with the matching value. */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    return key in vars ? vars[key] : "";
  });
}

/** Returns the list of required variables that are missing from the template. */
export function findMissingRequiredVariables(
  template: string,
  required: readonly { variable: string; required: boolean }[],
): string[] {
  return required
    .filter((v) => v.required)
    .map((v) => v.variable)
    .filter((v) => !template.includes(v));
}
