-- CreateTable
CREATE TABLE "task_submissions" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "image_url" TEXT,
    "clarification" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- AlterTable tasks
ALTER TABLE "tasks" ADD COLUMN "resubmission_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN "current_submission_id" UUID;

-- AlterTable votes
ALTER TABLE "votes" ADD COLUMN "submission_id" UUID;
ALTER TABLE "votes" ADD COLUMN "reason" TEXT;

-- Backfill submissions for tasks with proof image
INSERT INTO "task_submissions" ("id", "task_id", "attempt_number", "image_url", "clarification", "created_at")
SELECT
    gen_random_uuid(),
    t."id",
    1,
    t."image_url",
    NULL,
    COALESCE(t."created_at", NOW())
FROM "tasks" t
WHERE t."image_url" IS NOT NULL;

-- Backfill submissions for tasks with votes but no image
INSERT INTO "task_submissions" ("id", "task_id", "attempt_number", "image_url", "clarification", "created_at")
SELECT
    gen_random_uuid(),
    v."task_id",
    1,
    NULL,
    NULL,
    MIN(v."created_at")
FROM "votes" v
WHERE NOT EXISTS (
    SELECT 1 FROM "task_submissions" s WHERE s."task_id" = v."task_id"
)
GROUP BY v."task_id";

-- Link existing votes to backfilled submissions
UPDATE "votes" v
SET "submission_id" = s."id"
FROM "task_submissions" s
WHERE s."task_id" = v."task_id"
  AND s."attempt_number" = 1
  AND v."submission_id" IS NULL;

-- Set current submission on tasks that have an active submission
UPDATE "tasks" t
SET "current_submission_id" = s."id"
FROM "task_submissions" s
WHERE s."task_id" = t."id"
  AND s."attempt_number" = (
    SELECT MAX(s2."attempt_number") FROM "task_submissions" s2 WHERE s2."task_id" = t."id"
  )
  AND t."status" IN ('submitted', 'disputed');

-- Set resubmission count from submission attempts
UPDATE "tasks" t
SET "resubmission_count" = GREATEST(0, (
    SELECT COUNT(*) - 1 FROM "task_submissions" s WHERE s."task_id" = t."id"
));

-- Drop old unique constraint on votes
DROP INDEX IF EXISTS "votes_task_id_user_id_key";

-- Make submission_id required
ALTER TABLE "votes" ALTER COLUMN "submission_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_task_id_attempt_number_key" ON "task_submissions"("task_id", "attempt_number");
CREATE INDEX "task_submissions_task_id_idx" ON "task_submissions"("task_id");
CREATE UNIQUE INDEX "tasks_current_submission_id_key" ON "tasks"("current_submission_id");
CREATE INDEX "votes_submission_id_idx" ON "votes"("submission_id");
CREATE UNIQUE INDEX "votes_submission_id_user_id_key" ON "votes"("submission_id", "user_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_current_submission_id_fkey" FOREIGN KEY ("current_submission_id") REFERENCES "task_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "task_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
