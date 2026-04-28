-- CreateEnum
CREATE TYPE "AvatarVideoConceptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AvatarVideoCreationStatus" ADD VALUE 'PENDING_CONCEPT';
ALTER TYPE "AvatarVideoCreationStatus" ADD VALUE 'CONCEPT_READY';

-- AlterTable
ALTER TABLE "AvatarProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AvatarVideoCreation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AvatarVideoImageVariation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AvatarVideoPrompt" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VideoScenario" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AvatarVideoConcept" (
    "id" TEXT NOT NULL,
    "creationId" TEXT NOT NULL,
    "status" "AvatarVideoConceptStatus" NOT NULL DEFAULT 'PENDING',
    "videoIdea" TEXT,
    "hook" TEXT,
    "copy" TEXT,
    "cta" TEXT,
    "scenesJson" JSONB,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarVideoConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvatarVideoConcept_creationId_key" ON "AvatarVideoConcept"("creationId");

-- CreateIndex
CREATE INDEX "AvatarVideoConcept_status_idx" ON "AvatarVideoConcept"("status");

-- AddForeignKey
ALTER TABLE "AvatarVideoConcept" ADD CONSTRAINT "AvatarVideoConcept_creationId_fkey" FOREIGN KEY ("creationId") REFERENCES "AvatarVideoCreation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
