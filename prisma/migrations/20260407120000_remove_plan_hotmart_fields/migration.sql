-- DropColumns: Plan.hotmartProductId, Plan.hotmartPlanCode, Plan.hotmartOfferCode
-- These fields were used for local Hotmart plan mapping. Provisioning is now
-- provider-agnostic: the system uses the first active internal plan (by sortOrder).
-- Hotmart product/plan/offer metadata is stored in HotmartSubscription as
-- external reference data, not as a local mirror.

ALTER TABLE "Plan" DROP COLUMN IF EXISTS "hotmartProductId";
ALTER TABLE "Plan" DROP COLUMN IF EXISTS "hotmartPlanCode";
ALTER TABLE "Plan" DROP COLUMN IF EXISTS "hotmartOfferCode";
