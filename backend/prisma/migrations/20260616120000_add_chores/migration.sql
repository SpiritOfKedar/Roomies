-- CreateTable
CREATE TABLE "chores" (
    "id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "cron_schedule" TEXT,
    "reward_points" INTEGER NOT NULL DEFAULT 10,
    "penalty_fine" DECIMAL(10,2) NOT NULL DEFAULT 50.0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "chore_id" UUID,
ADD COLUMN "cycle_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN "chore_id" UUID,
ADD COLUMN "submission_id" UUID;

-- CreateIndex
CREATE INDEX "chores_house_id_idx" ON "chores"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "chores_house_id_title_key" ON "chores"("house_id", "title");

-- CreateIndex
CREATE INDEX "tasks_chore_id_idx" ON "tasks"("chore_id");

-- CreateIndex
CREATE INDEX "tasks_chore_id_cycle_number_idx" ON "tasks"("chore_id", "cycle_number");

-- CreateIndex
CREATE INDEX "task_comments_chore_id_idx" ON "task_comments"("chore_id");

-- CreateIndex
CREATE INDEX "task_comments_submission_id_idx" ON "task_comments"("submission_id");

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (deferred until backfill)
-- chore_id FK added after backfill script runs

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "task_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
