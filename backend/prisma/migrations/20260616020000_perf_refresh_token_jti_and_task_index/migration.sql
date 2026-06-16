-- AlterTable: add unique jti for O(1) refresh-token lookup (replaces full bcrypt scan)
ALTER TABLE "refresh_tokens" ADD COLUMN "jti" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex: serve the active-task list (filter by status + order by created_at) from one index
CREATE INDEX "tasks_house_id_status_created_at_idx" ON "tasks"("house_id", "status", "created_at" DESC);
