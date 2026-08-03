-- AlterTable
ALTER TABLE "ShopeeProductTrend" ADD COLUMN "categoryName" TEXT,
ADD COLUMN "subCategoryName" TEXT,
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "subCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "ShopeeProductTrend_categoryId_idx" ON "ShopeeProductTrend"("categoryId");

-- CreateIndex
CREATE INDEX "ShopeeProductTrend_subCategoryId_idx" ON "ShopeeProductTrend"("subCategoryId");

-- CreateIndex
CREATE INDEX "ShopeeProductTrend_categoryName_idx" ON "ShopeeProductTrend"("categoryName");