-- Add showOnLanding to Plan: defaults true so all existing plans stay visible
ALTER TABLE "Plan" ADD COLUMN "showOnLanding" BOOLEAN NOT NULL DEFAULT true;
