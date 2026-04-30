-- AlterTable: add avatar/scenario selection fields to AvatarVideoCreation
ALTER TABLE "AvatarVideoCreation"
  ADD COLUMN IF NOT EXISTS "uploadedAvatarImageUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "customScenarioDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "tone"                      TEXT,
  ADD COLUMN IF NOT EXISTS "duration"                  TEXT,
  ADD COLUMN IF NOT EXISTS "takeCount"                 INTEGER;
