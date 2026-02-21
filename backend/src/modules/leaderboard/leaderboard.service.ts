import { prisma } from '../../shared/db/prisma';
import * as houseService from '../house/house.service';

/**
 * Generate a dynamic leaderboard for a house based on tasks and penalties.
 *
 * Score Formula: (approved_tasks * 10) - sum(penalty_points)
 *
 * Includes only active members.
 *
 * @param houseId - The house UUID
 * @param userId - The requesting user (verified against members)
 */
export async function getHouseLeaderboard(houseId: string, userId: string) {
  // 1. Verify Requesting User is a Member
  await houseService.verifyMembership(houseId, userId);

  // 2. Fetch Aggregated Metrics
  const rawLeaderboard = await prisma.$queryRaw<
    Array<{
      user_id: string;
      user_name: string;
      completed_tasks: bigint;
      total_penalty_points: bigint;
      score: bigint;
    }>
  >`
        SELECT 
            u.id AS user_id,
            u.name AS user_name,
            COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_tasks,
            COALESCE((
                SELECT SUM(p.points) 
                FROM penalties p 
                JOIN tasks t2 ON p.task_id = t2.id 
                WHERE p.user_id = u.id
                  AND t2.house_id = hm.house_id
                  AND p.status = 'unpaid'
            ), 0) AS total_penalty_points,
            (COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) * 10) 
            - COALESCE((
                SELECT SUM(p.points) 
                FROM penalties p 
                JOIN tasks t2 ON p.task_id = t2.id 
                WHERE p.user_id = u.id
                  AND t2.house_id = hm.house_id
                  AND p.status = 'unpaid'
            ), 0) AS score
        FROM house_members hm
        JOIN users u ON hm.user_id = u.id
        LEFT JOIN tasks t ON t.assigned_to = u.id AND t.house_id = hm.house_id
        WHERE hm.house_id = ${houseId}::uuid AND hm.status = 'active'
        GROUP BY u.id, u.name, hm.house_id
        ORDER BY score DESC;
    `;

  // 3. Format payload (convert BigInts back to standard Numbers for JSON)
  const formatted = rawLeaderboard.map(
    (row: {
      user_id: string;
      user_name: string;
      completed_tasks: bigint;
      total_penalty_points: bigint;
      score: bigint;
    }) => ({
      userId: row.user_id,
      name: row.user_name,
      completedTasks: Number(row.completed_tasks),
      penaltyPoints: Number(row.total_penalty_points),
      score: Number(row.score),
    }),
  );

  return formatted;
}
