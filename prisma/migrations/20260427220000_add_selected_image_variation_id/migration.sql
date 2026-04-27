-- Add selectedImageVariationId to AvatarVideoCreation
-- Nullable String (no FK constraint — variations are deleted on regeneration and this is cleared explicitly)
ALTER TABLE "AvatarVideoCreation"
  ADD COLUMN IF NOT EXISTS "selectedImageVariationId" TEXT;
