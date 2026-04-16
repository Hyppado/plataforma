-- Add checkoutUrl to Plan: nullable, no default, safe for existing rows
ALTER TABLE "Plan" ADD COLUMN "checkoutUrl" TEXT;
