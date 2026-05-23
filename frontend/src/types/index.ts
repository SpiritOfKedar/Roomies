// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface AuthTokens {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: User;
}

// ── Houses ────────────────────────────────────────────────────────────────────
export interface HouseMember {
  id: string;
  houseId: string;
  userId: string;
  role: 'admin' | 'member';
  status: 'active' | 'on_leave' | 'inactive';
  joinedAt: string;
  user: { id: string; name: string; email: string };
}

export interface House {
  id: string;
  name: string;
  createdBy: string;
  currentIndex: number;
  createdAt: string;
  /** Optional: only present if backend populates it */
  inviteCode?: string;
  members: HouseMember[];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'submitted' | 'completed' | 'rejected' | 'expired' | 'disputed';

export interface Task {
  id: string;
  houseId: string;
  /** DB field: assigned_to */
  assignedTo: string;
  title: string;
  status: TaskStatus;
  /** ISO datetime string */
  deadline: string;
  createdAt: string;
  rewardPoints: number;
  penaltyFine: string;
  isRecurring: boolean;
  cronSchedule?: string;
  imageUrl?: string;
  aiScore?: number;
  aiVerdict?: string;
  assignee?: { id: string; name: string; email: string };
  /** Alias populated by some API responses */
  weight?: number;
  resubmissionCount?: number;
  currentSubmissionId?: string | null;
  currentSubmission?: TaskSubmission | null;
  maxResubmissions?: number;
  attemptsRemaining?: number;
}

export interface TaskSubmission {
  id: string;
  attemptNumber: number;
  imageUrl?: string | null;
  clarification?: string | null;
  createdAt: string;
}

export interface PaginatedTasks {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ── Votes ─────────────────────────────────────────────────────────────────────
export interface VoteResult {
  taskId: string;
  submissionId?: string;
  finalStatus: string;
  votingComplete?: boolean;
  tallies: { approved: number; rejected: number; required: number };
  eligibleVoters: number;
}

export interface VoteRecord {
  userId: string;
  userName: string;
  vote: 'approve' | 'reject';
  reason: string | null;
  createdAt: string;
}

export interface TaskVoteStatus {
  taskId: string;
  status: string;
  submissionId: string | null;
  tallies: { approved: number; rejected: number; required: number };
  eligibleVoters: number;
  votesCast: number;
  votingComplete: boolean;
  userVote: { vote: string; reason: string | null } | null;
  votes: VoteRecord[];
}

export interface TaskHistoryRound {
  submissionId: string;
  attemptNumber: number;
  imageUrl?: string | null;
  clarification?: string | null;
  submittedAt: string;
  isCurrent: boolean;
  outcome: string | null;
  votes: VoteRecord[];
  tallies: { approved: number; rejected: number };
}

export interface TaskHistory {
  taskId: string;
  title: string;
  status: string;
  resubmissionCount: number;
  maxResubmissions: number;
  rounds: TaskHistoryRound[];
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export type SplitStatus = 'unpaid' | 'settled';

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  /** DB field: owed_by (userId) */
  owedBy: string;
  amount: string | number;
  status: SplitStatus;
  createdAt: string;
  user?: { id: string; name: string };
}

export interface Expense {
  id: string;
  houseId: string;
  /** DB field: paid_by (userId) */
  paidBy: string;
  amount: string | number;
  description: string;
  receiptUrl?: string;
  createdAt: string;
  payer?: { id: string; name: string };
  splits: ExpenseSplit[];
}

export interface PaginatedExpenses {
  items: Expense[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  userId: string;
  name?: string;
  user?: { id: string; name: string };
  completedTasks: number;
  penaltyPoints: number;
  /** Aggregate score */
  score?: number;
  totalPoints?: number;
}

// ── Swaps ─────────────────────────────────────────────────────────────────────
export type SwapStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';

export interface TaskSwap {
  id: string;
  houseId: string;
  requesterId: string;
  receiverId: string;
  offeredTaskId: string;
  requestedTaskId: string;
  status: SwapStatus;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; name: string };
  receiver?: { id: string; name: string };
  offeredTask?: { id: string; title: string };
  requestedTask?: { id: string; title: string };
}

// ── Penalties ─────────────────────────────────────────────────────────────────
export type PenaltyStatus = 'unpaid' | 'settled' | 'forgiven';

export interface Penalty {
  id: string;
  userId: string;
  taskId: string;
  points: number;
  fineAmount: string | number;
  /** Optional reason text */
  reason?: string;
  status: PenaltyStatus;
  createdAt: string;
  user?: { id: string; name: string };
  task?: { id: string; title: string; houseId: string };
}

// ── API generic ───────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}
