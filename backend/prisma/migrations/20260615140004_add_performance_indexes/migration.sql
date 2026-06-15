-- CreateIndex
CREATE INDEX "house_members_house_id_status_idx" ON "house_members"("house_id", "status");

-- CreateIndex
CREATE INDEX "tasks_house_id_created_at_idx" ON "tasks"("house_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_spawned_from_task_id_idx" ON "tasks"("spawned_from_task_id");

-- CreateIndex
CREATE INDEX "tasks_house_id_status_idx" ON "tasks"("house_id", "status");

-- CreateIndex
CREATE INDEX "tasks_house_id_title_status_idx" ON "tasks"("house_id", "title", "status");
