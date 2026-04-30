-- Add avatarVideoQuota to Plan
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "avatarVideoQuota" INTEGER NOT NULL DEFAULT 0;

-- Add avatarVideosUsed to UsagePeriod
ALTER TABLE "UsagePeriod" ADD COLUMN IF NOT EXISTS "avatarVideosUsed" INTEGER NOT NULL DEFAULT 0;

-- Add AVATAR_VIDEO_GENERATION to UsageEventType enum
ALTER TYPE "UsageEventType" ADD VALUE IF NOT EXISTS 'AVATAR_VIDEO_GENERATION';
