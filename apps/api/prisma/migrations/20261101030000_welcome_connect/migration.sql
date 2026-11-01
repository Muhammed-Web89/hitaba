-- Hoş geldin jetonu: henüz hiç sohbet açmamış ve bu hediyeyi almamış erkeklere 1 jeton.
WITH eligible AS (
  SELECT u."id" FROM "User" u
  WHERE u."gender" = 'MALE' AND u."role" = 'USER' AND u."status" NOT IN ('BANNED', 'DELETED')
    AND NOT EXISTS (SELECT 1 FROM "ConnectTx" t WHERE t."userId" = u."id" AND (t."note" = 'welcome' OR t."type" = 'SPEND'))
), credited AS (
  UPDATE "User" SET "connectBalance" = "connectBalance" + 1 WHERE "id" IN (SELECT "id" FROM eligible) RETURNING "id"
)
INSERT INTO "ConnectTx" ("id", "userId", "amount", "type", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", 1, 'BONUS', 'welcome', CURRENT_TIMESTAMP FROM credited;
