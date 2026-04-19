-- Add missing columns to AdminNotification table that was created with an older schema

ALTER TABLE "AdminNotification"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'hotmart',
  ADD COLUMN IF NOT EXISTS "severity" "NotificationSeverity" NOT NULL DEFAULT 'WARNING',
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

-- CreateIndex for dedupeKey uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotification_dedupeKey_key" ON "AdminNotification"("dedupeKey");

-- CreateIndex for status+severity
CREATE INDEX IF NOT EXISTS "AdminNotification_status_severity_idx" ON "AdminNotification"("status", "severity");

-- CreateIndex for source+createdAt
CREATE INDEX IF NOT EXISTS "AdminNotification_source_createdAt_idx" ON "AdminNotification"("source", "createdAt");

-- CreateIndex for createdAt
CREATE INDEX IF NOT EXISTS "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex for userId
CREATE INDEX IF NOT EXISTS "AdminNotification_userId_idx" ON "AdminNotification"("userId");

-- CreateIndex for type+createdAt
CREATE INDEX IF NOT EXISTS "AdminNotification_type_createdAt_idx" ON "AdminNotification"("type", "createdAt");
