-- CreateTable
CREATE TABLE "ShopeeProductTrend" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rankPosition" INTEGER NOT NULL DEFAULT 0,
    "productExternalId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "coverUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "gmv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopName" TEXT,
    "affiliateLink" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopeeProductTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopeeAchadinhoProduct" (
    "id" TEXT NOT NULL,
    "videoExternalId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "videoTitle" TEXT,
    "coverUrl" TEXT,
    "transcriptText" TEXT,
    "productName" TEXT,
    "category" TEXT,
    "affiliateLink" TEXT,
    "originalAffLink" TEXT,
    "price" DOUBLE PRECISION,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopeeAchadinhoProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopeeProductTrend_productExternalId_key" ON "ShopeeProductTrend"("productExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopeeAchadinhoProduct_videoExternalId_key" ON "ShopeeAchadinhoProduct"("videoExternalId");

-- CreateIndex
CREATE INDEX "ShopeeAchadinhoProduct_status_createdAt_idx" ON "ShopeeAchadinhoProduct"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopeeAchadinhoProduct_category_idx" ON "ShopeeAchadinhoProduct"("category");
