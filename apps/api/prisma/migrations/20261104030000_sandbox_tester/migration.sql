-- Yöneticinin verdiği "deneme profillerini görebilir" yetkisi
ALTER TABLE "User" ADD COLUMN "sandboxTester" BOOLEAN NOT NULL DEFAULT false;
