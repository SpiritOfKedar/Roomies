import { prisma } from '../../shared/db/prisma';
import * as leaderboardService from '../../modules/leaderboard/leaderboard.service';
import * as houseService from '../../modules/house/house.service';

// Mock house Service so we don't try to query DB for membership during unit testing
jest.mock('../../modules/house/house.service', () => ({
    verifyMembership: jest.fn().mockResolvedValue(true),
}));

describe('Unit Test: Leaderboard Engine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('TC1: Given mocked SQL query array, maps BigInts correctly and returns payload', async () => {
        // 1. Mock Prisma $queryRaw returning a raw PG result matching our complex SQL statement

        // Note: The actual calculation and sorting (tasks * 10 - penalties) is securely performed
        // inside our raw PostgreSQL execution layer. This test specifically isolates and validates
        // the Node.js payload ingestion, BigInt to Int translation, and map projections.
        jest.spyOn(prisma, '$queryRaw').mockResolvedValue([
            {
                user_id: 'alice-id',
                user_name: 'Alice',
                completed_tasks: BigInt(5), // 5 tasks = 50 pts
                total_penalty_points: BigInt(10), // -10 pts
                score: BigInt(40), // 50 - 10 = 40
            },
            {
                user_id: 'bob-id',
                user_name: 'Bob',
                completed_tasks: BigInt(3), // 3 tasks = 30 pts
                total_penalty_points: BigInt(0), // 0 pts
                score: BigInt(30), // 30 - 0 = 30
            },
            {
                user_id: 'charlie-id',
                user_name: 'Charlie',
                completed_tasks: BigInt(0),
                total_penalty_points: BigInt(50), // -50 pts
                score: BigInt(-50), // 0 - 50 = -50
            },
        ]);

        // 2. Execute service logic
        const leaderboard = await leaderboardService.getHouseLeaderboard('mock-house-id', 'mock-user-id');

        // 3. Assertions
        expect(houseService.verifyMembership).toHaveBeenCalledWith('mock-house-id', 'mock-user-id');
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

        // Verify mapping and payload conversion bounds
        expect(leaderboard.length).toBe(3);

        expect(leaderboard[0].userId).toBe('alice-id');
        expect(leaderboard[0].name).toBe('Alice');
        expect(leaderboard[0].completedTasks).toBe(5);
        expect(leaderboard[0].penaltyPoints).toBe(10);
        expect(leaderboard[0].score).toBe(40);

        expect(leaderboard[1].score).toBe(30);
        expect(leaderboard[2].score).toBe(-50);
    });
});
