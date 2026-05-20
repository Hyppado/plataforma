/*
  Warnings:

  - A unique constraint covering the columns `[hotmartNumericPlanId]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "hotmartNumericPlanId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_hotmartNumericPlanId_key" ON "Plan"("hotmartNumericPlanId");
