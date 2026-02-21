-- AlterTable
ALTER TABLE "penalties" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'unpaid';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "cron_schedule" TEXT,
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "penalty_fine" DECIMAL(10,2) NOT NULL DEFAULT 50.0,
ADD COLUMN     "reward_points" INTEGER NOT NULL DEFAULT 10;
