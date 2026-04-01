-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PlanPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED', 'CHARGEBACK', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ErasureStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('TRANSCRIPT', 'SCRIPT', 'INSIGHT');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "lgpdConsentAt" TIMESTAMP(3),
    "lgpdConsentVersion" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayPrice" TEXT,
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "periodicity" "PlanPeriod" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transcriptsPerMonth" INTEGER NOT NULL DEFAULT 40,
    "scriptsPerMonth" INTEGER NOT NULL DEFAULT 70,
    "insightTokensMonthlyMax" INTEGER NOT NULL DEFAULT 50000,
    "scriptTokensMonthlyMax" INTEGER NOT NULL DEFAULT 20000,
    "insightMaxOutputTokens" INTEGER NOT NULL DEFAULT 800,
    "scriptMaxOutputTokens" INTEGER NOT NULL DEFAULT 1500,
    "hotmartProductId" TEXT,
    "hotmartPlanCode" TEXT,
    "hotmartOfferCode" TEXT,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanExternalMapping" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalCode" TEXT,
    "externalMeta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanExternalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "hotmartCouponCode" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "offerCode" TEXT,
    "name" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'hotmart',
    "startedAt" TIMESTAMP(3),
    "renewedAt" TIMESTAMP(3),
    "nextChargeAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotmartSubscription" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "hotmartSubscriptionId" TEXT NOT NULL,
    "hotmartProductId" TEXT,
    "hotmartPlanCode" TEXT,
    "hotmartOfferCode" TEXT,
    "buyerEmail" TEXT,
    "subscriberCode" TEXT,
    "externalStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotmartSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "chargeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAccountLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "externalReference" TEXT,
    "externalEmail" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkConfidence" TEXT NOT NULL DEFAULT 'auto_email',
    "linkMethod" TEXT NOT NULL DEFAULT 'webhook',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotmartWebhookEvent" (
    "id" TEXT NOT NULL,
    "payloadVersion" TEXT,
    "eventType" TEXT NOT NULL,
    "eventExternalId" TEXT,
    "transactionId" TEXT,
    "purchaseStatus" TEXT,
    "isSubscription" BOOLEAN,
    "recurrenceNumber" INTEGER,
    "amountCents" INTEGER,
    "currency" TEXT,
    "paymentType" TEXT,
    "offerCode" TEXT,
    "subscriptionExternalId" TEXT,
    "subscriberCode" TEXT,
    "subscriberEmail" TEXT,
    "planCode" TEXT,
    "planId" TEXT,
    "subscriptionStatus" TEXT,
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "occurredAt" TIMESTAMP(3),
    "payloadJson" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "processingStatus" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "HotmartWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "planId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataErasureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ErasureStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,
    "anonymizedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataErasureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "planId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "type" TEXT NOT NULL,
    "payloadJson" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsagePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "transcriptsUsed" INTEGER NOT NULL DEFAULT 0,
    "scriptsUsed" INTEGER NOT NULL DEFAULT 0,
    "insightsUsed" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "refTable" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "type" TEXT NOT NULL DEFAULT 'text',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EchotikCategory" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentExternalId" TEXT,
    "slug" TEXT,
    "extra" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchotikCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchotikVideoTrendDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rankingCycle" INTEGER NOT NULL DEFAULT 1,
    "rankField" INTEGER NOT NULL DEFAULT 2,
    "rankPosition" INTEGER NOT NULL DEFAULT 0,
    "videoExternalId" TEXT NOT NULL,
    "title" TEXT,
    "authorName" TEXT,
    "authorExternalId" TEXT,
    "views" BIGINT NOT NULL DEFAULT 0,
    "likes" BIGINT NOT NULL DEFAULT 0,
    "comments" BIGINT NOT NULL DEFAULT 0,
    "favorites" BIGINT NOT NULL DEFAULT 0,
    "shares" BIGINT NOT NULL DEFAULT 0,
    "saleCount" BIGINT NOT NULL DEFAULT 0,
    "gmv" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT NOT NULL DEFAULT 'US',
    "categoryId" TEXT,
    "extra" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EchotikVideoTrendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchotikProductTrendDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rankingCycle" INTEGER NOT NULL DEFAULT 1,
    "rankField" INTEGER NOT NULL DEFAULT 1,
    "rankPosition" INTEGER NOT NULL DEFAULT 0,
    "productExternalId" TEXT NOT NULL,
    "productName" TEXT,
    "categoryId" TEXT,
    "categoryL2Id" TEXT,
    "categoryL3Id" TEXT,
    "minPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleCount" BIGINT NOT NULL DEFAULT 0,
    "gmv" BIGINT NOT NULL DEFAULT 0,
    "influencerCount" BIGINT NOT NULL DEFAULT 0,
    "videoCount" BIGINT NOT NULL DEFAULT 0,
    "liveCount" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT NOT NULL DEFAULT 'US',
    "extra" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EchotikProductTrendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchotikCreatorTrendDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rankingCycle" INTEGER NOT NULL DEFAULT 1,
    "rankField" INTEGER NOT NULL DEFAULT 2,
    "rankPosition" INTEGER NOT NULL DEFAULT 0,
    "userExternalId" TEXT NOT NULL,
    "uniqueId" TEXT,
    "nickName" TEXT,
    "avatar" TEXT,
    "category" TEXT,
    "ecScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followersCount" BIGINT NOT NULL DEFAULT 0,
    "saleCount" BIGINT NOT NULL DEFAULT 0,
    "gmv" BIGINT NOT NULL DEFAULT 0,
    "diggCount" BIGINT NOT NULL DEFAULT 0,
    "productCount" BIGINT NOT NULL DEFAULT 0,
    "videoCount" BIGINT NOT NULL DEFAULT 0,
    "liveCount" BIGINT NOT NULL DEFAULT 0,
    "mostCategoryId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT NOT NULL DEFAULT 'US',
    "extra" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EchotikCreatorTrendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchotikProductDetail" (
    "id" TEXT NOT NULL,
    "productExternalId" TEXT NOT NULL,
    "productName" TEXT,
    "coverUrl" TEXT,
    "avgPrice" DECIMAL(12,2),
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "rating" DECIMAL(3,2),
    "commissionRate" DECIMAL(5,4),
    "categoryId" TEXT,
    "region" TEXT,
    "extra" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchotikProductDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchotikRawResponse" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "paramsJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "ingestionRunId" TEXT,

    CONSTRAINT "EchotikRawResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'echotik',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "IngestionStatus" NOT NULL DEFAULT 'RUNNING',
    "statsJson" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_isActive_sortOrder_idx" ON "Plan"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanExternalMapping_planId_idx" ON "PlanExternalMapping"("planId");

-- CreateIndex
CREATE INDEX "PlanExternalMapping_provider_isActive_idx" ON "PlanExternalMapping"("provider", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlanExternalMapping_provider_externalId_key" ON "PlanExternalMapping"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_hotmartCouponCode_key" ON "Coupon"("hotmartCouponCode");

-- CreateIndex
CREATE INDEX "Coupon_productId_idx" ON "Coupon"("productId");

-- CreateIndex
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HotmartSubscription_subscriptionId_key" ON "HotmartSubscription"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "HotmartSubscription_hotmartSubscriptionId_key" ON "HotmartSubscription"("hotmartSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "HotmartSubscription_subscriberCode_key" ON "HotmartSubscription"("subscriberCode");

-- CreateIndex
CREATE INDEX "HotmartSubscription_hotmartProductId_idx" ON "HotmartSubscription"("hotmartProductId");

-- CreateIndex
CREATE INDEX "HotmartSubscription_subscriberCode_idx" ON "HotmartSubscription"("subscriberCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_transactionId_key" ON "SubscriptionCharge"("transactionId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_idx" ON "SubscriptionCharge"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_transactionId_idx" ON "SubscriptionCharge"("transactionId");

-- CreateIndex
CREATE INDEX "ExternalAccountLink_provider_externalEmail_idx" ON "ExternalAccountLink"("provider", "externalEmail");

-- CreateIndex
CREATE INDEX "ExternalAccountLink_userId_idx" ON "ExternalAccountLink"("userId");

-- CreateIndex
CREATE INDEX "ExternalAccountLink_provider_isActive_idx" ON "ExternalAccountLink"("provider", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccountLink_provider_externalCustomerId_key" ON "ExternalAccountLink"("provider", "externalCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "HotmartWebhookEvent_idempotencyKey_key" ON "HotmartWebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_eventType_receivedAt_idx" ON "HotmartWebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_processingStatus_retryCount_idx" ON "HotmartWebhookEvent"("processingStatus", "retryCount");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_subscriberCode_idx" ON "HotmartWebhookEvent"("subscriberCode");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_transactionId_idx" ON "HotmartWebhookEvent"("transactionId");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_buyerEmail_idx" ON "HotmartWebhookEvent"("buyerEmail");

-- CreateIndex
CREATE INDEX "HotmartWebhookEvent_subscriptionExternalId_idx" ON "HotmartWebhookEvent"("subscriptionExternalId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_isActive_idx" ON "AccessGrant"("userId", "isActive");

-- CreateIndex
CREATE INDEX "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_consentType_idx" ON "ConsentRecord"("userId", "consentType");

-- CreateIndex
CREATE INDEX "DataErasureRequest_status_idx" ON "DataErasureRequest"("status");

-- CreateIndex
CREATE INDEX "DataErasureRequest_userId_idx" ON "DataErasureRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE INDEX "SavedItem_userId_type_idx" ON "SavedItem"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_type_externalId_key" ON "SavedItem"("userId", "type", "externalId");

-- CreateIndex
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_type_externalId_key" ON "CollectionItem"("collectionId", "type", "externalId");

-- CreateIndex
CREATE INDEX "Note_userId_type_externalId_idx" ON "Note"("userId", "type", "externalId");

-- CreateIndex
CREATE INDEX "Alert_userId_read_idx" ON "Alert"("userId", "read");

-- CreateIndex
CREATE INDEX "UsagePeriod_userId_periodStart_idx" ON "UsagePeriod"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsagePeriod_userId_periodStart_key" ON "UsagePeriod"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_occurredAt_idx" ON "UsageEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_type_occurredAt_idx" ON "UsageEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "Setting_group_idx" ON "Setting"("group");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikCategory_externalId_key" ON "EchotikCategory"("externalId");

-- CreateIndex
CREATE INDEX "EchotikCategory_level_idx" ON "EchotikCategory"("level");

-- CreateIndex
CREATE INDEX "EchotikCategory_language_idx" ON "EchotikCategory"("language");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_date_idx" ON "EchotikVideoTrendDaily"("date");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_country_date_idx" ON "EchotikVideoTrendDaily"("country", "date");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_country_date_rankingCycle_idx" ON "EchotikVideoTrendDaily"("country", "date", "rankingCycle");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_country_date_rankingCycle_rankField_idx" ON "EchotikVideoTrendDaily"("country", "date", "rankingCycle", "rankField");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_categoryId_date_idx" ON "EchotikVideoTrendDaily"("categoryId", "date");

-- CreateIndex
CREATE INDEX "EchotikVideoTrendDaily_rankPosition_idx" ON "EchotikVideoTrendDaily"("rankPosition");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikVideoTrendDaily_videoExternalId_date_country_ranking_key" ON "EchotikVideoTrendDaily"("videoExternalId", "date", "country", "rankingCycle", "rankField");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_date_idx" ON "EchotikProductTrendDaily"("date");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_country_date_idx" ON "EchotikProductTrendDaily"("country", "date");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_country_date_rankingCycle_idx" ON "EchotikProductTrendDaily"("country", "date", "rankingCycle");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_country_date_rankingCycle_rankFiel_idx" ON "EchotikProductTrendDaily"("country", "date", "rankingCycle", "rankField");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_categoryId_date_idx" ON "EchotikProductTrendDaily"("categoryId", "date");

-- CreateIndex
CREATE INDEX "EchotikProductTrendDaily_rankPosition_idx" ON "EchotikProductTrendDaily"("rankPosition");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikProductTrendDaily_productExternalId_date_country_ran_key" ON "EchotikProductTrendDaily"("productExternalId", "date", "country", "rankingCycle", "rankField");

-- CreateIndex
CREATE INDEX "EchotikCreatorTrendDaily_date_idx" ON "EchotikCreatorTrendDaily"("date");

-- CreateIndex
CREATE INDEX "EchotikCreatorTrendDaily_country_date_idx" ON "EchotikCreatorTrendDaily"("country", "date");

-- CreateIndex
CREATE INDEX "EchotikCreatorTrendDaily_country_date_rankingCycle_idx" ON "EchotikCreatorTrendDaily"("country", "date", "rankingCycle");

-- CreateIndex
CREATE INDEX "EchotikCreatorTrendDaily_country_date_rankingCycle_rankFiel_idx" ON "EchotikCreatorTrendDaily"("country", "date", "rankingCycle", "rankField");

-- CreateIndex
CREATE INDEX "EchotikCreatorTrendDaily_rankPosition_idx" ON "EchotikCreatorTrendDaily"("rankPosition");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikCreatorTrendDaily_userExternalId_date_country_rankin_key" ON "EchotikCreatorTrendDaily"("userExternalId", "date", "country", "rankingCycle", "rankField");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikProductDetail_productExternalId_key" ON "EchotikProductDetail"("productExternalId");

-- CreateIndex
CREATE INDEX "EchotikProductDetail_fetchedAt_idx" ON "EchotikProductDetail"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EchotikRawResponse_payloadHash_key" ON "EchotikRawResponse"("payloadHash");

-- CreateIndex
CREATE INDEX "EchotikRawResponse_endpoint_fetchedAt_idx" ON "EchotikRawResponse"("endpoint", "fetchedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_source_startedAt_idx" ON "IngestionRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_dedupeKey_key" ON "AdminNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminNotification_status_severity_idx" ON "AdminNotification"("status", "severity");

-- CreateIndex
CREATE INDEX "AdminNotification_source_createdAt_idx" ON "AdminNotification"("source", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_userId_idx" ON "AdminNotification"("userId");

-- CreateIndex
CREATE INDEX "AdminNotification_type_createdAt_idx" ON "AdminNotification"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanExternalMapping" ADD CONSTRAINT "PlanExternalMapping_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotmartSubscription" ADD CONSTRAINT "HotmartSubscription_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAccountLink" ADD CONSTRAINT "ExternalAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataErasureRequest" ADD CONSTRAINT "DataErasureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsagePeriod" ADD CONSTRAINT "UsagePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "UsagePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchotikRawResponse" ADD CONSTRAINT "EchotikRawResponse_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HotmartWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

