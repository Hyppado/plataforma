-- CreateTable
CREATE TABLE "influencer_ia_draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_ia_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "influencer_ia_draft_userId_key" ON "influencer_ia_draft"("userId");

-- AddForeignKey
ALTER TABLE "influencer_ia_draft" ADD CONSTRAINT "influencer_ia_draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
