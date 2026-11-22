export const queryKeys = {
  houseDashboard: (houseId: string, statusFilter: 'active' | 'all' = 'active') =>
    ['house', houseId, 'dashboard', statusFilter] as const,
  expenses: (houseId: string, page: number) => ['house', houseId, 'expenses', page] as const,
  leaderboard: (houseId: string) => ['house', houseId, 'leaderboard'] as const,
  swaps: (houseId: string) => ['house', houseId, 'swaps'] as const,
  penalties: (houseId: string) => ['house', houseId, 'penalties'] as const,
  messages: (houseId: string) => ['house', houseId, 'messages'] as const,
  choreThread: (choreId: string) => ['chore', choreId, 'thread'] as const,
  taskVotes: (taskId: string) => ['task', taskId, 'votes'] as const,
};
