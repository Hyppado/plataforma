-- Add CASCADE/SET NULL delete rules to User-related foreign keys
-- This ensures User deletion propagates correctly without manual cleanup

-- ExternalAccountLink: user-owned → CASCADE
ALTER TABLE "ExternalAccountLink" DROP CONSTRAINT "ExternalAccountLink_userId_fkey";
ALTER TABLE "ExternalAccountLink" ADD CONSTRAINT "ExternalAccountLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription: user-owned → CASCADE
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HotmartSubscription: subscription-owned → CASCADE
ALTER TABLE "HotmartSubscription" DROP CONSTRAINT "HotmartSubscription_subscriptionId_fkey";
ALTER TABLE "HotmartSubscription" ADD CONSTRAINT "HotmartSubscription_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SubscriptionCharge: subscription-owned → CASCADE
ALTER TABLE "SubscriptionCharge" DROP CONSTRAINT "SubscriptionCharge_subscriptionId_fkey";
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog: preserve trail, nullify user ref → SET NULL
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ConsentRecord: user-owned LGPD data → CASCADE
ALTER TABLE "ConsentRecord" DROP CONSTRAINT "ConsentRecord_userId_fkey";
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataErasureRequest: user-owned LGPD data → CASCADE
ALTER TABLE "DataErasureRequest" DROP CONSTRAINT "DataErasureRequest_userId_fkey";
ALTER TABLE "DataErasureRequest" ADD CONSTRAINT "DataErasureRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
