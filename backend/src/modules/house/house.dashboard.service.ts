/**
 * Aggregate house dashboard — one round-trip for house page initial load.
 */

import * as houseService from './house.service';
import * as houseRepo from './house.repository';
import * as choresRepo from '../tasks/chores.repository';
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

  const cachedPayload = await cached(
    `${houseDashboardKey(houseId, userId)}:${statusFilter}`,
    DASHBOARD_TTL_SEC,
    async () => {
      const [house, choresResult] = await Promise.all([
        houseRepo.findHouseWithMembers(houseId),
        choresRepo.getChoresByHouse(houseId, DASHBOARD_TASK_LIMIT, 0, statusFilter),
      ]);

      if (!house) {
        return null;
      }

      const isMember = house.members.some((m) => m.userId === userId);
      if (!isMember) {
        return null;
      }

      return {
        house,
        chores: {
          items: choresResult.chores,
          total: choresResult.total,
          limit: DASHBOARD_TASK_LIMIT,
          offset: 0,
          hasMore: DASHBOARD_TASK_LIMIT < choresResult.total,
          completedCount: choresResult.completedChoreCount,
        },
      };
    },
  );

  if (!cachedPayload) {
    return null;
  }

  // Vote statuses are always fetched fresh — never bundled in the dashboard cache
  // so list UI cannot show stale vote state after a user casts a vote.
  const submittedIds = cachedPayload.chores.items
    .map((c) => c.activeInstance)
    .filter((t): t is NonNullable<typeof t> => !!t && t.status === 'submitted')
    .map((t) => t.id);

  const voteStatuses =
    submittedIds.length > 0
      ? await fetchVoteStatusBatchUncached(userId, houseId, submittedIds)
      : {};

  return {
    ...cachedPayload,
    voteStatuses,
  };
}
