-- Deneme hesapları gerçek kullanıcılardan ayrı tutulur.
ALTER TABLE "User" ADD COLUMN "isSandbox" BOOLEAN NOT NULL DEFAULT false;
