-- CreateTable
CREATE TABLE "PromptLibraryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "videoBlobUrl" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptLibraryItem_category_idx" ON "PromptLibraryItem"("category");

-- CreateIndex
CREATE INDEX "PromptLibraryItem_isActive_idx" ON "PromptLibraryItem"("isActive");

-- CreateIndex
CREATE INDEX "PromptLibraryItem_createdAt_idx" ON "PromptLibraryItem"("createdAt");

-- AddForeignKey
ALTER TABLE "PromptLibraryItem" ADD CONSTRAINT "PromptLibraryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
