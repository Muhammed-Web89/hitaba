-- Evli erkeklerin mevcut eş sayısı
ALTER TABLE "Profile" ADD COLUMN "currentWives" INTEGER NOT NULL DEFAULT 0;
