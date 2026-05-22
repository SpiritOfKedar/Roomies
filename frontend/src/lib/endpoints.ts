import api from './api';
import type {
  AuthTokens, House, PaginatedTasks, Task, VoteResult,
  PaginatedExpenses, Expense, ExpenseSplit,
  LeaderboardEntry, TaskSwap, Penalty,
} from '@/types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (name: string, email: string, password: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    api.post<{ success: boolean; data: AuthTokens }>('/api/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refreshToken }),
  me: () => api.get<{ success: boolean; data: AuthTokens['user'] }>('/api/users/me'),
};

// ── Houses ────────────────────────────────────────────────────────────────────
export const housesApi = {
  list: () =>
    api.get<{ success: boolean; data: House[] }>('/api/houses'),
  get: (id: string) =>
    api.get<{ success: boolean; data: House }>(`/api/houses/${id}`),
  create: (body: { name: string; address?: string }) =>
    api.post<{ success: boolean; data: House }>('/api/houses', body),
  join: (inviteCode: string) =>
    api.post<{ success: boolean; data: House }>('/api/houses/join', { inviteCode }),
  updateMember: (houseId: string, userId: string, status: string) =>
    api.patch(`/api/houses/${houseId}/members/${userId}`, { status }),
  addMemberByEmail: (houseId: string, email: string) =>
    api.post<{ success: boolean; data: House }>(`/api/houses/${houseId}/members/email`, { email }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (houseId: string, page = 1, limit = 10) =>
    api.get<{ success: boolean; data: PaginatedTasks }>(`/api/houses/${houseId}/tasks`, {
      params: { limit, offset: (page - 1) * limit },
    }),
  assign: (houseId: string, body: {
    title: string;
    description?: string;
    deadline?: string;
    assignedTo?: string;
    weight?: number;
  }) =>
    api.post<{ success: boolean; data: Task }>(`/api/houses/${houseId}/tasks/assign`, body),
  submit: (_houseId: string, taskId: string, form: FormData) =>
    api.post<{ success: boolean; data: Task }>(
      `/api/tasks/${taskId}/submit`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),
  vote: (_houseId: string, taskId: string, vote: 'approve' | 'reject') =>
    api.post<{ success: boolean; data: VoteResult }>(
      `/api/tasks/${taskId}/vote`,
      { vote }
    ),
  update: (houseId: string, taskId: string, data: Partial<Task>) =>
    api.patch<{ success: boolean; data: Task }>(`/api/houses/${houseId}/tasks/${taskId}`, data),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (houseId: string, page = 1, limit = 10) =>
    api.get<{ success: boolean; data: PaginatedExpenses }>(`/api/houses/${houseId}/expenses`, {
      params: { limit, offset: (page - 1) * limit },
    }),
  create: (houseId: string, form: FormData) =>
    api.post<{ success: boolean; data: Expense }>(
      `/api/houses/${houseId}/expenses`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),
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
