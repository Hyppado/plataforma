-- Add product fields from Shopee API node to ShopeeAchadinhoProduct
ALTER TABLE "ShopeeAchadinhoProduct" ADD COLUMN IF NOT EXISTS "productImageUrl" TEXT;
ALTER TABLE "ShopeeAchadinhoProduct" ADD COLUMN IF NOT EXISTS "productPriceMin" DOUBLE PRECISION;
ALTER TABLE "ShopeeAchadinhoProduct" ADD COLUMN IF NOT EXISTS "productPriceMax" DOUBLE PRECISION;
ALTER TABLE "ShopeeAchadinhoProduct" ADD COLUMN IF NOT EXISTS "productLink" TEXT;