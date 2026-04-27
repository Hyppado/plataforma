-- Migration: add_avatar_video_creation_flow
-- Additive only — no DROP, no DELETE, no TRUNCATE.

-- Enums

CREATE TYPE "AvatarVideoCreationStatus" AS ENUM (
  'DRAFT',
  'PENDING_IMAGES',
  'IMAGES_READY',
  'PENDING_PROMPT',
  'PROMPT_READY',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "AvatarVideoImageStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED'
);

CREATE TYPE "AvatarVideoPromptStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED'
);

-- AvatarProfile

CREATE TABLE "AvatarProfile" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT         NOT NULL,
  "description"  TEXT,
  "imageUrl"     TEXT         NOT NULL,
  "thumbnailUrl" TEXT,
  "isActive"     BOOLEAN      NOT NULL DEFAULT true,
  "sortOrder"    INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AvatarProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvatarProfile_isActive_sortOrder_idx" ON "AvatarProfile"("isActive", "sortOrder");

-- VideoScenario

CREATE TABLE "VideoScenario" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "promptHint"  TEXT,
  "isDefault"   BOOLEAN      NOT NULL DEFAULT false,
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoScenario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoScenario_isActive_isDefault_sortOrder_idx" ON "VideoScenario"("isActive", "isDefault", "sortOrder");

-- AvatarVideoCreation

CREATE TABLE "AvatarVideoCreation" (
  "id"                      TEXT                        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"                  TEXT                        NOT NULL,
  "avatarProfileId"         TEXT,
  "videoScenarioId"         TEXT,
  "status"                  "AvatarVideoCreationStatus" NOT NULL DEFAULT 'DRAFT',
  "productExternalId"       TEXT,
  "productName"             TEXT,
  "productImageUrl"         TEXT,
  "productSelectedImageUrl" TEXT,
  "productPriceCents"       INTEGER,
  "productCurrency"         TEXT,
  "productCategory"         TEXT,
  "errorMessage"            TEXT,
  "createdAt"               TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3)                NOT NULL,

  CONSTRAINT "AvatarVideoCreation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvatarVideoCreation_userId_status_idx"    ON "AvatarVideoCreation"("userId", "status");
CREATE INDEX "AvatarVideoCreation_userId_createdAt_idx" ON "AvatarVideoCreation"("userId", "createdAt");
CREATE INDEX "AvatarVideoCreation_status_createdAt_idx" ON "AvatarVideoCreation"("status", "createdAt");

ALTER TABLE "AvatarVideoCreation"
  ADD CONSTRAINT "AvatarVideoCreation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvatarVideoCreation"
  ADD CONSTRAINT "AvatarVideoCreation_avatarProfileId_fkey"
    FOREIGN KEY ("avatarProfileId") REFERENCES "AvatarProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AvatarVideoCreation"
  ADD CONSTRAINT "AvatarVideoCreation_videoScenarioId_fkey"
    FOREIGN KEY ("videoScenarioId") REFERENCES "VideoScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AvatarVideoImageVariation

CREATE TABLE "AvatarVideoImageVariation" (
  "id"           TEXT                     NOT NULL DEFAULT gen_random_uuid()::text,
  "creationId"   TEXT                     NOT NULL,
  "blobUrl"      TEXT,
  "status"       "AvatarVideoImageStatus" NOT NULL DEFAULT 'PENDING',
  "sortOrder"    INTEGER                  NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt"    TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)             NOT NULL,

  CONSTRAINT "AvatarVideoImageVariation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvatarVideoImageVariation_creationId_idx" ON "AvatarVideoImageVariation"("creationId");

ALTER TABLE "AvatarVideoImageVariation"
  ADD CONSTRAINT "AvatarVideoImageVariation_creationId_fkey"
    FOREIGN KEY ("creationId") REFERENCES "AvatarVideoCreation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AvatarVideoPrompt

CREATE TABLE "AvatarVideoPrompt" (
  "id"           TEXT                      NOT NULL DEFAULT gen_random_uuid()::text,
  "creationId"   TEXT                      NOT NULL,
  "promptJson"   JSONB,
  "promptText"   TEXT,
  "status"       "AvatarVideoPromptStatus" NOT NULL DEFAULT 'PENDING',
  "isEdited"     BOOLEAN                   NOT NULL DEFAULT false,
  "editedAt"     TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt"    TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)              NOT NULL,

  CONSTRAINT "AvatarVideoPrompt_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "AvatarVideoPrompt_creationId_key" UNIQUE ("creationId")
);

CREATE INDEX "AvatarVideoPrompt_status_idx" ON "AvatarVideoPrompt"("status");

ALTER TABLE "AvatarVideoPrompt"
  ADD CONSTRAINT "AvatarVideoPrompt_creationId_fkey"
    FOREIGN KEY ("creationId") REFERENCES "AvatarVideoCreation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
