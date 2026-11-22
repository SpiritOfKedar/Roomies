// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: User;
}

// ── Recovery ──────────────────────────────────────────────────────────────────
export type RecoveryMethod = 'email' | 'security_questions';
export type RecoveryTokenType = 'email' | 'recovery';

export interface SecurityQuestionOption {
  questionId: string;
  text: string;
}

export interface RecoveryOptions {
  methods: RecoveryMethod[];
  questions: SecurityQuestionOption[];
}

export interface RecoveryStatus {
  hasSecurityQuestions: boolean;
  questionCount: number;
  hasPassword: boolean;
  availableQuestions: SecurityQuestionOption[];
}

export interface SecurityQuestionAnswer {
  questionId: string;
  answer: string;
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

export interface HouseDashboard {
  house: House;
  chores: PaginatedChores;
  voteStatuses: Record<string, TaskVoteStatus>;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'submitted' | 'completed' | 'rejected' | 'expired' | 'disputed';

export interface Task {
  id: string;
  houseId: string;
  choreId?: string;
  cycleNumber?: number;
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
  /** Total submissions allowed: the original + maxResubmissions retries */
  maxAttempts?: number;
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
  /** Count of completed/expired/rejected tasks (only set when statusFilter=active) */
  completedCount?: number;
}

export interface Chore {
  id: string;
  houseId: string;
  title: string;
  isRecurring: boolean;
  cronSchedule?: string | null;
  rewardPoints: number;
  penaltyFine: string;
  createdAt: string;
  activeInstance: Task | null;
  completedCycleCount: number;
  totalCycles: number;
}

export interface PaginatedChores {
  items: Chore[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  completedCount?: number;
}

// ── Votes ─────────────────────────────────────────────────────────────────────
export interface VoteResult {
  taskId: string;
  submissionId?: string;
  finalStatus: string;
  votingComplete?: boolean;
  tallies: { approved: number; rejected: number; required: number };
  eligibleVoters: number;
  rotation?: {
    newTaskId: string;
    assignedTo?: string;
    assigneeName?: string;
  };
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

export interface TaskFeedItem {
  id: string;
  kind: 'activity' | 'submission' | 'comment';
  createdAt: string;
  taskId: string;
  data: Record<string, unknown>;
}

export interface TaskCommentNode {
  id: string;
  taskId: string;
  choreId?: string | null;
  submissionId?: string | null;
  userId: string;
  parentId: string | null;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  user: { id: string; name: string };
  replies: TaskCommentNode[];
}

export interface ChoreThreadSubmission {
  submissionId: string;
  attemptNumber: number;
  imageUrl?: string | null;
  clarification?: string | null;
  submittedAt: string;
  isCurrent: boolean;
  outcome: string | null;
  tallies: { approved: number; rejected: number };
  votes: VoteRecord[];
  comments: TaskCommentNode[];
}

export interface ChoreThreadCycle {
  cycleNumber: number;
  instanceId: string;
  assigneeName: string;
  assigneeId: string;
  status: string;
  deadline: string;
  completedAt?: string;
  submissions: ChoreThreadSubmission[];
}

export interface ChoreThread {
  choreId: string;
  title: string;
  isRecurring: boolean;
  rewardPoints: number;
  penaltyFine: string | number;
  maxResubmissions: number;
  activeInstance: Task | null;
  cycles: ChoreThreadCycle[];
}

export interface TaskFeed {
  taskId: string;
  title: string;
  status: string;
  taskIds: string[];
  items: TaskFeedItem[];
  comments: TaskCommentNode[];
}

export interface HouseMessage {
  id: string;
  houseId: string;
  userId: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  user: { id: string; name: string };
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
