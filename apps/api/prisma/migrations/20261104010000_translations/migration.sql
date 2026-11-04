-- Kullanıcı metinlerinin çeviri önbelleği
CREATE TABLE "Translation" (
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Translation_pkey" PRIMARY KEY ("key")
);
