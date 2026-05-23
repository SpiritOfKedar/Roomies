-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "rotation_spawned_at" TIMESTAMPTZ;
ALTER TABLE "tasks" ADD COLUMN "spawned_from_task_id" UUID;

-- Backfill: mark completed tasks that already have a newer open instance of same chore
UPDATE "tasks" AS completed
SET "rotation_spawned_at" = NOW()
WHERE completed."status" = 'completed'
  AND completed."rotation_spawned_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "tasks" AS newer
    WHERE newer."house_id" = completed."house_id"
      AND newer."title" = completed."title"
      AND newer."created_at" > completed."created_at"
      AND newer."status" IN ('pending', 'submitted', 'disputed')
  );

CREATE INDEX "tasks_spawned_from_task_id_idx" ON "tasks"("spawned_from_task_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_spawned_from_task_id_fkey" FOREIGN KEY ("spawned_from_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
