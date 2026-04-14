-- AlterTable
ALTER TABLE "EchotikCreatorTrendDaily" ADD COLUMN     "avatarBlobUrl" TEXT;

-- AlterTable
ALTER TABLE "EchotikProductDetail" ADD COLUMN     "blobUrl" TEXT;

-- AlterTable
ALTER TABLE "EchotikVideoTrendDaily" ADD COLUMN     "downloadUrl" TEXT,
ADD COLUMN     "downloadUrlFetchedAt" TIMESTAMP(3);
