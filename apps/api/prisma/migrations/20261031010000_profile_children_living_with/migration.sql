-- Çocuklardan kaçının kişiyle birlikte yaşadığı
ALTER TABLE "Profile" ADD COLUMN "childrenLivingWith" INTEGER NOT NULL DEFAULT 0;
