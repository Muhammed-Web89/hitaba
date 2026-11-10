-- Sohbet kotası: her taraf moderatör onayına kadar sınırlı sayıda mesaj yazar; "devam et" isteği moderatöre gider.
ALTER TYPE "ModerationTarget" ADD VALUE 'CHAT_EXTENSION';
ALTER TABLE "Chat" ADD COLUMN "quotaResetAt" TIMESTAMP(3);
ALTER TABLE "Chat" ADD COLUMN "extensionRequestedAt" TIMESTAMP(3);
-- Süren sohbetler yeni kuralla sıfırdan başlar.
UPDATE "Chat" SET "quotaResetAt" = CURRENT_TIMESTAMP WHERE "status" <> 'CLOSED';
