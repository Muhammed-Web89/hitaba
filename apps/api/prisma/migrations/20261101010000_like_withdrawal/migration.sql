-- CreateTable
CREATE TABLE "LikeWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikeWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LikeWithdrawal_userId_createdAt_idx" ON "LikeWithdrawal"("userId", "createdAt");
