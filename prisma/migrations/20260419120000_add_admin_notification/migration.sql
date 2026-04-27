-- CreateEnum (idempotent — enums already exist in baseline)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationSeverity') THEN
    CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
    CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
  END IF;
END $$;

-- CreateTable (idempotent — table already exists in baseline)
CREATE TABLE IF NOT EXISTS "AdminNotification" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'hotmart',
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "dedupeKey" TEXT,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotification_dedupeKey_key" ON "AdminNotification"("dedupeKey");
CREATE INDEX IF NOT EXISTS "AdminNotification_status_severity_idx" ON "AdminNotification"("status", "severity");
CREATE INDEX IF NOT EXISTS "AdminNotification_source_createdAt_idx" ON "AdminNotification"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminNotification_userId_idx" ON "AdminNotification"("userId");
CREATE INDEX IF NOT EXISTS "AdminNotification_type_createdAt_idx" ON "AdminNotification"("type", "createdAt");

-- AddForeignKey (idempotent — skip if constraint already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminNotification_userId_fkey'
  ) THEN
    ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminNotification_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminNotification_eventId_fkey'
  ) THEN
    ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "HotmartWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
