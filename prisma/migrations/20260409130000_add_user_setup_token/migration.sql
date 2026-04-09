-- AlterTable
ALTER TABLE "User" ADD COLUMN "setupToken" TEXT,
ADD COLUMN "setupTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_setupToken_key" ON "User"("setupToken");
