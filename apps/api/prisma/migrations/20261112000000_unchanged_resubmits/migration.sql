-- Reddedilen anketin içerik özeti ve değişmeden yeniden gönderim sayısı.
ALTER TABLE "Profile" ADD COLUMN "rejectedHash" TEXT;
ALTER TABLE "Profile" ADD COLUMN "unchangedResubmits" INTEGER NOT NULL DEFAULT 0;
