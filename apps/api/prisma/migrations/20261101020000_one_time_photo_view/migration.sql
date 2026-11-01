-- Kadın fotoğrafı artık 24 saat değil, istek başına bir kez görülebilir.
ALTER TABLE "Match" ADD COLUMN "malePhotoViewGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "photoViewRequestedAt" TIMESTAMP(3);

-- Onaylanmış eşleşmelerde süren 24 saatlik pencereler kapanır; yerine bir görme hakkı verilir.
UPDATE "Match" SET "malePhotoViewGranted" = true, "malePhotoAccessUntil" = NULL
WHERE "stage" IN ('PHOTO_APPROVED', 'CHAT_OPEN');
