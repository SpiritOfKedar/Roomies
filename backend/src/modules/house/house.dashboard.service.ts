/**
 * Aggregate house dashboard — one round-trip for house page initial load.
 */

import * as houseService from './house.service';
import * as houseRepo from './house.repository';
import * as tasksRepo from '../tasks/tasks.repository';
import { fetchVoteStatusBatchUncached } from '../voting/voting.service';
import { cached, houseDashboardKey } from '../../shared/cache/redis-cache';

const DASHBOARD_TASK_LIMIT = 100;
const DASHBOARD_TTL_SEC = 60;

export async function getHouseDashboard(
  userId: string,
  houseId: string,
  statusFilter: 'active' | 'all' = 'active',
) {
  await houseService.verifyMembership(houseId, userId);

  return cached(`${houseDashboardKey(houseId, userId)}:${statusFilter}`, DASHBOARD_TTL_SEC, async () => {
    // Hit the DB directly here — wrapping these in their own read-through caches
    // would add extra (remote) Redis round-trips inside an already-cached path.
    const [house, tasksResult] = await Promise.all([
      houseRepo.findHouseWithMembers(houseId),
      tasksRepo.getTasksByHouse(houseId, DASHBOARD_TASK_LIMIT, 0, statusFilter),
    ]);

    if (!house) {
      return null;
    }

    const isMember = house.members.some((m) => m.userId === userId);
    if (!isMember) {
      return null;
    }

    const submittedIds = tasksResult.tasks
      .filter((t) => t.status === 'submitted')
      .map((t) => t.id);

    const voteStatuses =
      submittedIds.length > 0
        ? await fetchVoteStatusBatchUncached(userId, houseId, submittedIds)
        : {};

    return {
      house,
      tasks: {
        items: tasksResult.tasks,
        total: tasksResult.total,
        limit: DASHBOARD_TASK_LIMIT,
        offset: 0,
        hasMore: DASHBOARD_TASK_LIMIT < tasksResult.total,
        completedCount: tasksResult.completedCount,
      },
      voteStatuses,
    };
  });
}
