-- Kadın sohbetteyken gelen beğeniler sohbet bitene kadar bekletilir.
ALTER TABLE "Like" ADD COLUMN "held" BOOLEAN NOT NULL DEFAULT false;
