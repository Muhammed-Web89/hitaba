-- Personel güvenliği: iki adımlı doğrulama, cihaz oturumları, giriş geçmişi
ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffSession_userId_revokedAt_idx" ON "StaffSession"("userId", "revokedAt");
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
