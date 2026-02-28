-- AlterTable: Add invite_code column to houses
-- Generate a random 8-char alphanumeric code for existing rows

ALTER TABLE "houses" ADD COLUMN "invite_code" VARCHAR(8);

-- Backfill existing rows with random codes
UPDATE "houses" SET "invite_code" = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)) WHERE "invite_code" IS NULL;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "houses" ALTER COLUMN "invite_code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "houses_invite_code_key" ON "houses"("invite_code");
