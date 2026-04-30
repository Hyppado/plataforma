-- CreateTable
CREATE TABLE "UserAvatarUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAvatarUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAvatarUpload_userId_createdAt_idx" ON "UserAvatarUpload"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserAvatarUpload" ADD CONSTRAINT "UserAvatarUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
