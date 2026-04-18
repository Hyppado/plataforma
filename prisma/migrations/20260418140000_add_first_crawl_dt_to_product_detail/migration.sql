-- AddColumn: firstCrawlDt (nullable) to EchotikProductDetail
ALTER TABLE "EchotikProductDetail" ADD COLUMN "firstCrawlDt" INTEGER;
CREATE INDEX "EchotikProductDetail_firstCrawlDt_idx" ON "EchotikProductDetail"("firstCrawlDt");
