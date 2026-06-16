/**
 * Backfill chores from existing task rotation lineages.
 * Run after migration 20260616120000_add_chores:
 *   npx tsx scripts/backfill-chores.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TaskRow = {
  id: string;
  houseId: string;
  title: string;
  isRecurring: boolean;
  cronSchedule: string | null;
  rewardPoints: number;
  penaltyFine: { toNumber(): number };
  createdAt: Date;
  spawnedFromTaskId: string | null;
};

function findRoot(taskId: string, byId: Map<string, TaskRow>): string {
  const visited = new Set<string>();
  let current = taskId;
  while (true) {
    if (visited.has(current)) return current;
    visited.add(current);
    const row = byId.get(current);
    if (!row?.spawnedFromTaskId) return current;
    current = row.spawnedFromTaskId;
  }
}

async function main() {
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      houseId: true,
      title: true,
      isRecurring: true,
      cronSchedule: true,
      rewardPoints: true,
      penaltyFine: true,
      createdAt: true,
      spawnedFromTaskId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const byId = new Map(tasks.map((t) => [t.id, t as TaskRow]));

  // Group tasks into lineages by root id
  const lineages = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const rootId = findRoot(task.id, byId);
    const list = lineages.get(rootId) ?? [];
    list.push(task as TaskRow);
    lineages.set(rootId, list);
  }

  // Merge lineages that share house+title (unlinked duplicates)
  const titleGroups = new Map<string, string[]>();
  for (const [rootId, members] of lineages) {
    const root = byId.get(rootId)!;
    const key = `${root.houseId}::${root.title}`;
    const roots = titleGroups.get(key) ?? [];
    roots.push(rootId);
    titleGroups.set(key, roots);
  }

  const mergedLineages = new Map<string, TaskRow[]>();
  for (const [, rootIds] of titleGroups) {
    const allTasks: TaskRow[] = [];
    for (const rootId of rootIds) {
      allTasks.push(...(lineages.get(rootId) ?? []));
    }
    allTasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const canonicalRoot = rootIds[0];
    mergedLineages.set(canonicalRoot, allTasks);
  }

  let choresCreated = 0;
  let tasksUpdated = 0;

  for (const [rootId, members] of mergedLineages) {
    const root = byId.get(rootId)!;

    let chore = await prisma.chore.findUnique({
      where: { houseId_title: { houseId: root.houseId, title: root.title } },
    });

    if (!chore) {
      chore = await prisma.chore.create({
        data: {
          houseId: root.houseId,
          title: root.title,
          isRecurring: root.isRecurring,
          cronSchedule: root.cronSchedule,
          rewardPoints: root.rewardPoints,
          penaltyFine: root.penaltyFine,
          createdAt: root.createdAt,
        },
      });
      choresCreated++;
    }

    const sorted = [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < sorted.length; i++) {
      await prisma.task.update({
        where: { id: sorted[i].id },
        data: { choreId: chore.id, cycleNumber: i + 1 },
      });
      tasksUpdated++;
    }
  }

  // Ensure FK exists
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "tasks" ADD CONSTRAINT "tasks_chore_id_fkey"
        FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "tasks" ALTER COLUMN "chore_id" SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  console.log(`Backfill complete: ${choresCreated} chores, ${tasksUpdated} tasks updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
