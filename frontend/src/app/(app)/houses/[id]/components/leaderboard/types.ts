export interface LeaderboardEntry {
  userId: string;
  name?: string;
  user?: { name?: string };
  completedTasks: number;
  penaltyPoints: number;
  score?: number;
  totalPoints?: number;
}
