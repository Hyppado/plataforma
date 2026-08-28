-- Cota de download de vídeos dos Achadinhos Shopee.
ALTER TYPE "UsageEventType" ADD VALUE 'SHOPEE_VIDEO_DOWNLOAD';

ALTER TABLE "UsagePeriod" ADD COLUMN "shopeeDownloadsUsed" INTEGER NOT NULL DEFAULT 0;

-- 10/mês para todos os planos. 0 significa ilimitado (mesma convenção das
-- demais cotas), por isso o default é 10 e não 0.
ALTER TABLE "Plan" ADD COLUMN "shopeeDownloadsPerMonth" INTEGER NOT NULL DEFAULT 10;
