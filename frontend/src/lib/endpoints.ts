import api from './api';
import type {
  AuthTokens, House, HouseDashboard, PaginatedTasks, PaginatedChores, Task, VoteResult, TaskVoteStatus, TaskHistory,
  TaskFeed, TaskCommentNode, ChoreThread, HouseMessage,
  PaginatedExpenses, Expense, ExpenseSplit,
  LeaderboardEntry, TaskSwap, Penalty,
  RecoveryOptions, RecoveryStatus, RecoveryTokenType, SecurityQuestionAnswer,
} from '@/types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (name: string, email: string, password: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/login', { email, password }),
  googleLogin: (idToken: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/google', { idToken }),
  googleExchange: (code: string) =>
    api.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
      '/api/auth/google/exchange',
      { code },
    ),
  refresh: (refreshToken: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refreshToken }),
  me: () => api.get<{ success: boolean; data: AuthTokens['user'] }>('/api/users/me'),
};

export const recoveryApi = {
  options: (email: string) =>
    api.post<{ success: boolean; data: RecoveryOptions }>('/api/auth/recovery/options', { email }),
  sendEmail: (email: string) =>
    api.post<{ success: boolean; data: { message: string } }>('/api/auth/recovery/email', { email }),
  verifyQuestions: (email: string, answers: SecurityQuestionAnswer[]) =>
    api.post<{ success: boolean; data: { recoveryToken: string } }>(
      '/api/auth/recovery/verify-questions',
      { email, answers },
    ),
  verifyToken: (token: string, type: RecoveryTokenType) =>
    api.get<{ success: boolean; data: { valid: boolean } }>('/api/auth/recovery/verify-token', {
      params: { token, type },
    }),
  resetPassword: (token: string, type: RecoveryTokenType, newPassword: string) =>
    api.post<{ success: boolean; data: { message: string } }>('/api/auth/recovery/reset-password', {
      token,
      type,
      newPassword,
    }),
};

export const usersApi = {
  getRecoveryStatus: () =>
    api.get<{ success: boolean; data: RecoveryStatus }>('/api/users/me/recovery'),
  setSecurityQuestions: (
    questions: SecurityQuestionAnswer[],
    currentPassword?: string,
  ) =>
    api.put<{ success: boolean; data: { message: string } }>('/api/users/me/security-questions', {
      questions,
      ...(currentPassword ? { currentPassword } : {}),
    }),
  deleteSecurityQuestions: (currentPassword?: string) =>
    api.delete<{ success: boolean; data: { message: string } }>('/api/users/me/security-questions', {
      data: currentPassword ? { currentPassword } : {},
    }),
};

// ── Houses ────────────────────────────────────────────────────────────────────
export const housesApi = {
  list: () =>
    api.get<{ success: boolean; data: House[] }>('/api/houses'),
  get: (id: string) =>
    api.get<{ success: boolean; data: House }>(`/api/houses/${id}`),
  dashboard: (id: string, statusFilter: 'active' | 'all' = 'active') =>
    api.get<{ success: boolean; data: HouseDashboard }>(`/api/houses/${id}/dashboard`, {
      params: { statusFilter },
    }),
  create: (body: { name: string; address?: string }) =>
    api.post<{ success: boolean; data: House }>('/api/houses', body),
  join: (inviteCode: string) =>
    api.post<{ success: boolean; data: House }>('/api/houses/join', { inviteCode }),
  updateMember: (houseId: string, userId: string, status: string) =>
    api.patch(`/api/houses/${houseId}/members/${userId}`, { status }),
  leave: (houseId: string) =>
    api.post(`/api/houses/${houseId}/leave`),
  addMemberByEmail: (houseId: string, email: string) =>
    api.post<{ success: boolean; data: House }>(`/api/houses/${houseId}/members/email`, { email }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (houseId: string, page = 1, limit = 10, statusFilter: 'active' | 'all' = 'active') =>
    api.get<{ success: boolean; data: PaginatedTasks }>(`/api/houses/${houseId}/tasks`, {
      params: { limit, offset: (page - 1) * limit, statusFilter },
    }),
  getVoteStatuses: (houseId: string, taskIds: string[]) =>
    api.get<{ success: boolean; data: Record<string, TaskVoteStatus> }>(
      `/api/houses/${houseId}/tasks/vote-statuses`,
      { params: { taskIds: taskIds.join(',') } },
    ),
  assign: (houseId: string, body: {
    title: string;
    description?: string;
    deadline?: string;
    assignedTo?: string;
    weight?: number;
    isRecurring?: boolean;
    cronSchedule?: string;
  }) =>
    api.post<{ success: boolean; data: Task }>(`/api/houses/${houseId}/chores/assign`, body),
  listChores: (houseId: string, page = 1, limit = 10, statusFilter: 'active' | 'all' = 'active') =>
    api.get<{ success: boolean; data: PaginatedChores }>(`/api/houses/${houseId}/chores`, {
      params: { limit, offset: (page - 1) * limit, statusFilter },
    }),
  submit: (_houseId: string, taskId: string, form: FormData) =>
    api.post<{ success: boolean; data: Task }>(`/api/tasks/${taskId}/submit`, form),
  get: (taskId: string) =>
    api.get<{ success: boolean; data: Task }>(`/api/tasks/${taskId}`),
  getVotes: (taskId: string) =>
    api.get<{ success: boolean; data: TaskVoteStatus }>(`/api/tasks/${taskId}/votes`),
  getThread: (taskId: string) =>
    api.get<{ success: boolean; data: ChoreThread }>(`/api/tasks/${taskId}/thread`),
  getChoreThread: (choreId: string) =>
    api.get<{ success: boolean; data: ChoreThread }>(`/api/chores/${choreId}/thread`),
  vote: (_houseId: string, taskId: string, vote: 'approve' | 'reject', reason?: string) =>
    api.post<{ success: boolean; data: VoteResult }>(
      `/api/tasks/${taskId}/vote`,
      { vote, ...(reason ? { reason } : {}) }
    ),
  update: (
    houseId: string,
    taskId: string,
    data: Partial<Pick<Task, 'title' | 'deadline' | 'rewardPoints'>> & {
      assignedTo?: string;
      penaltyFine?: number;
    },
  ) =>
    api.patch<{ success: boolean; data: Task }>(`/api/houses/${houseId}/tasks/${taskId}`, data),
  delete: (houseId: string, taskId: string) =>
    api.delete<{ success: boolean; data: { deleted: boolean; taskId: string } }>(
      `/api/houses/${houseId}/tasks/${taskId}`,
    ),
  getFeed: (taskId: string) =>
    api.get<{ success: boolean; data: TaskFeed }>(`/api/tasks/${taskId}/feed`),
  addComment: (taskId: string, form: FormData) =>
    api.post<{ success: boolean; data: TaskCommentNode }>(`/api/tasks/${taskId}/comments`, form),
  deleteComment: (taskId: string, commentId: string) =>
    api.delete(`/api/tasks/${taskId}/comments/${commentId}`),
};

// ── House chat ────────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (houseId: string, limit = 50, opts?: { before?: string; after?: string }) =>
    api.get<{ success: boolean; data: HouseMessage[] }>(`/api/houses/${houseId}/messages`, {
      params: { limit, ...(opts?.before ? { before: opts.before } : {}), ...(opts?.after ? { after: opts.after } : {}) },
    }),
  send: (houseId: string, form: FormData) =>
    api.post<{ success: boolean; data: HouseMessage }>(`/api/houses/${houseId}/messages`, form),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (houseId: string, page = 1, limit = 10) =>
    api.get<{ success: boolean; data: PaginatedExpenses }>(`/api/houses/${houseId}/expenses`, {
      params: { limit, offset: (page - 1) * limit },
    }),
  create: (houseId: string, form: FormData) =>
    api.post<{ success: boolean; data: Expense }>(`/api/houses/${houseId}/expenses`, form),
  settleSplit: (houseId: string, _expenseId: string, splitId: string) =>
    api.post<{ success: boolean; data: ExpenseSplit }>(
      `/api/houses/${houseId}/expenses/splits/${splitId}/settle`
    ),
};

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardApi = {
  get: (houseId: string) =>
    api.get<{ success: boolean; data: LeaderboardEntry[] }>(`/api/houses/${houseId}/leaderboard`),
};

// ── Swaps ─────────────────────────────────────────────────────────────────────
export const swapsApi = {
  list: (houseId: string) =>
    api.get<{ success: boolean; data: TaskSwap[] }>(`/api/houses/${houseId}/swaps`),
  propose: (houseId: string, body: {
    offeredTaskId: string;
    requestedTaskId: string;
    receiverId: string;
  }) =>
    api.post<{ success: boolean; data: TaskSwap }>(`/api/houses/${houseId}/swaps`, body),
  resolve: (houseId: string, swapId: string, action: 'accept' | 'reject') =>
    api.post<{ success: boolean; data: TaskSwap }>(
      `/api/houses/${houseId}/swaps/${swapId}/resolve`,
      { action }
    ),
};

// ── Penalties ─────────────────────────────────────────────────────────────────
export const penaltiesApi = {
  list: (houseId: string) =>
    api.get<{ success: boolean; data: Penalty[] }>(`/api/houses/${houseId}/penalties`),
  settle: (houseId: string, penaltyId: string) =>
    api.post<{ success: boolean; data: Penalty }>(
      `/api/houses/${houseId}/penalties/${penaltyId}/settle`
    ),
};
