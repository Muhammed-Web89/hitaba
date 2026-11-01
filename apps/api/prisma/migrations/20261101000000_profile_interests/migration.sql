-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
