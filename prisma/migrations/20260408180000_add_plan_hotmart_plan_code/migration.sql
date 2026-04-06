-- Add hotmartPlanCode to Plan (links local plan to Hotmart plan code)
ALTER TABLE "Plan" ADD COLUMN "hotmartPlanCode" TEXT;

-- Unique index for planCode lookup (nullable — manual plans have NULL)
CREATE UNIQUE INDEX "Plan_hotmartPlanCode_key" ON "Plan" ("hotmartPlanCode");
