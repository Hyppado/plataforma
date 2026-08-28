-- A cota de download da Shopee passa a ser DIÁRIA, não mensal.
-- O valor (10) é o mesmo; muda a janela em que ele se aplica.
ALTER TABLE "Plan" RENAME COLUMN "shopeeDownloadsPerMonth" TO "shopeeDownloadsPerDay";
