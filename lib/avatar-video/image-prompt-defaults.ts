/**
 * Default example / placeholder for the admin-configurable image prompt.
 * Kept in a separate file with no server-only imports so it can be safely
 * imported by client components.
 */
export const DEFAULT_IMAGE_PROMPT_EXAMPLE = [
  "Photorealistic UGC-style product placement photo for TikTok Shop.",
  "",
  "SUBJECT: a young content creator.",
  'PRODUCT: "the product" — use the reference image as the exact source of truth. Do NOT invent, add, or change any colors, labels, text, logos, shapes, or details not clearly present in the reference. Do NOT distort the product.',
  'PLACEMENT: The person is holding and presenting "the product" naturally to camera. Reproduce the product exactly as it appears in the reference image.',
  "SETTING: bright, clean indoor space with soft natural light.",
  "",
  "TECHNICAL REQUIREMENTS:",
  "- Vertical 9:16 portrait format",
  "- Natural, professional lighting — photorealistic editorial quality",
  "- No text overlays, watermarks, or UI elements in the image",
  "- Do not add props, backgrounds, or accessories not specified above",
  "- Render the product exactly as in the reference — same shape, color, and finish",
  "- Product must be clearly visible and the focal point",
].join("\n");
