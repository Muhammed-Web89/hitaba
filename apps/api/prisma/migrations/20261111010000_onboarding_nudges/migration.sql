-- Profilini doldurmayanlara ve yalnızca /start diyenlere günlük Telegram hatırlatması.
ALTER TABLE "User" ADD COLUMN "nudgeSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "nudgeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "botBlockedAt" TIMESTAMP(3);

CREATE TABLE "BotStarter" (
    "chatId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nudgeSentAt" TIMESTAMP(3),
    "nudgeCount" INTEGER NOT NULL DEFAULT 0,
    "blockedAt" TIMESTAMP(3),
    CONSTRAINT "BotStarter_pkey" PRIMARY KEY ("chatId")
);
