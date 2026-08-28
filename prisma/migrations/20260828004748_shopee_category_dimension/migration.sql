-- Dimensão oficial de categorias da Shopee BR.
-- Mesma numeração de productCatIds da Affiliate API.
CREATE TABLE "ShopeeCategory" (
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopeeCategory_pkey" PRIMARY KEY ("categoryId")
);

CREATE INDEX "ShopeeCategory_level_idx" ON "ShopeeCategory"("level");
CREATE INDEX "ShopeeCategory_parentId_idx" ON "ShopeeCategory"("parentId");
