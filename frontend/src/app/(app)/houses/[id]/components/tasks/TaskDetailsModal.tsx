'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import Modal from '@/components/Modal';
import { tasksApi } from '@/lib/endpoints';
import type { Task, TaskFeed, TaskVoteStatus, HouseMember, TaskHistory } from '@/types';
import VoteProgressBar from './VoteProgressBar';
import ChoreFeed from './ChoreFeed';
import SubmissionTimeline from './SubmissionTimeline';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { resolveTaskProofUrl } from '@/lib/proofUrl';
import { formatINR } from '@/lib/currency';

interface Props {
  task: Task | null;
  members: HouseMember[];
  currentUserId?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmitProof: () => void;
  onResubmit: () => void;
  onVote: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

type DetailTab = 'overview' | 'history' | 'discussion';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-neutral-100 text-neutral-700',
  submitted: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  disputed: 'bg-amber-50 text-amber-800',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-orange-50 text-orange-700',
};

function ProofImage({ task, className }: { task: Task; className?: string }) {
  const proof = resolveTaskProofUrl(task);
  if (proof.url) {
    return (
      <img
        src={proof.url}
        alt="Task proof"
        className={className ?? 'w-full rounded-xl border border-neutral-200 object-cover'}
      />
    );
  }
  return (
    <div
      className={
        className ??
        'flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500'
      }
    >
      {proof.legacy ? 'Proof unavailable (legacy upload)' : 'No proof image attached'}
    </div>
  );
}

export default function TaskDetailsModal({
  task,
  members,
  currentUserId,
  isAdmin,
  onClose,
  onSubmitProof,
  onResubmit,
  onVote,
  onEdit,
  onDelete,
}: Props) {
  const [detailTask, setDetailTask] = useState<Task | null>(task);
  const [feed, setFeed] = useState<TaskFeed | null>(null);
  const [history, setHistory] = useState<TaskHistory | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voteStatus, setVoteStatus] = useState<TaskVoteStatus | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');

  const isAssignee = detailTask?.assignedTo === currentUserId;
  const assigneeMember = useMemo(
    () => members.find((m) => m.userId === detailTask?.assignedTo),
    [members, detailTask?.assignedTo],
  );
  const assigneeName =
    assigneeMember?.user?.name ?? detailTask?.assignee?.name ?? 'Unknown member';

  const refreshDetail = useCallback(async () => {
    if (!task?.id) return;
    try {
      const res = await tasksApi.get(task.id);
      setDetailTask(res.data.data);
    } catch {
      setDetailTask(task);
    }
  }, [task]);

  const loadFeed = useCallback(() => {
    if (!task?.id) return;
    setFeedLoading(true);
    tasksApi
      .getFeed(task.id)
      .then((res) => setFeed(res.data.data))
      .catch(() => setFeed(null))
      .finally(() => setFeedLoading(false));
  }, [task?.id]);

  const loadHistory = useCallback(() => {
    if (!task?.id) return;
    setHistoryLoading(true);
    tasksApi
      .getHistory(task.id)
      .then((res) => setHistory(res.data.data))
      .catch(() => setHistory(null))
      .finally(() => setHistoryLoading(false));
  }, [task?.id]);

  useTaskPolling(
    task?.id ?? null,
    !!task && detailTask?.status === 'submitted',
    (vs) => {
      setVoteStatus(vs);
      if (vs.votingComplete) {
        refreshDetail();
        loadFeed();
        loadHistory();
      }
    },
  );

  useEffect(() => {
    setDetailTask(task);
    setTab('overview');
    if (!task) {
      setFeed(null);
      setHistory(null);
      setVoteStatus(null);
      return;
    }
    refreshDetail();
    loadFeed();
    loadHistory();
    if (task.status === 'submitted') {
      tasksApi.getVotes(task.id).then((res) => setVoteStatus(res.data.data)).catch(() => {});
    } else {
      setVoteStatus(null);
    }
  }, [task?.id, task?.status, refreshDetail, loadFeed, loadHistory]);

  const canVote =
    detailTask?.status === 'submitted' &&
    !isAssignee &&
    !voteStatus?.userVote &&
    !voteStatus?.votingComplete;

  const canAdminEdit =
    isAdmin &&
    detailTask &&
    ['pending', 'submitted', 'disputed'].includes(detailTask.status);

  const submission = detailTask?.currentSubmission;

  const footer = detailTask ? (
    <div className="flex flex-wrap justify-end gap-2">
      {canAdminEdit && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      )}
      {canAdminEdit && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
      >
        Close
      </button>
      {isAssignee && detailTask.status === 'pending' && (
        <button
          type="button"
          onClick={onSubmitProof}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Submit Proof
        </button>
      )}
      {isAssignee && detailTask.status === 'disputed' && (
        <button
          type="button"
          onClick={onResubmit}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Resubmit
        </button>
      )}
      {canVote && (
        <button
          type="button"
          onClick={onVote}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Review & Vote
        </button>
      )}
    </div>
  ) : null;

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      title={detailTask?.title ?? 'Task Details'}
      size="xl"
      footer={footer}
    >
      {detailTask && (
        <div className="space-y-5">
          {/* Compact header row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[detailTask.status] ?? STATUS_STYLES.pending}`}
            >
              {detailTask.status}
            </span>
            <span className="text-sm text-neutral-500">
              {isAssignee ? 'Assigned to you' : assigneeName}
              {assigneeMember?.role && (
                <span className="ml-1 capitalize">· {assigneeMember.role}</span>
              )}
            </span>
            <span className="text-sm font-semibold text-emerald-600">
              +{detailTask.rewardPoints ?? 10} pts
            </span>
            {Number(detailTask.penaltyFine) > 0 && (
              <span className="text-sm text-red-500">
                {formatINR(detailTask.penaltyFine)} penalty
              </span>
            )}
            <span className="text-sm text-neutral-400">
              Due {format(new Date(detailTask.deadline), 'MMM d, h:mm a')}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-neutral-200">
            {(
              [
                { id: 'overview' as const, label: 'Overview' },
                { id: 'history' as const, label: 'History' },
                { id: 'discussion' as const, label: 'Discussion' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'border-b-2 border-neutral-900 text-neutral-900 -mb-px'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {label}
                {id === 'history' && (history?.rounds.length ?? 0) > 0 && (
                  <span className="ml-1.5 text-xs text-neutral-400">({history!.rounds.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {(submission || detailTask.status === 'submitted' || detailTask.status === 'disputed') ? (
                <div className="rounded-xl border border-neutral-200 p-5">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Current submission
                  </h3>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-neutral-500">Submitted by </span>
                        <span className="font-medium text-neutral-900">{assigneeName}</span>
                        {assigneeMember?.role && (
                          <span className="ml-1 capitalize text-neutral-400">({assigneeMember.role})</span>
                        )}
                      </div>
                      {submission?.createdAt && (
                        <div className="text-neutral-600">
                          {format(new Date(submission.createdAt), 'MMM d, yyyy · h:mm a')}
                          <span className="ml-2 text-neutral-400">
                            ({formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })})
                          </span>
                        </div>
                      )}
                      {submission?.clarification && (
                        <div className="rounded-lg bg-neutral-50 p-3 text-neutral-700">
                          {submission.clarification}
                        </div>
                      )}
                      {detailTask.status === 'submitted' && (
                        <VoteProgressBar voteStatus={voteStatus} />
                      )}
                      {voteStatus?.userVote && (
                        <p className="font-medium text-emerald-700">
                          You voted: <span className="capitalize">{voteStatus.userVote.vote}</span>
                        </p>
                      )}
                    </div>
                    <ProofImage task={detailTask} className="aspect-video w-full rounded-xl border border-neutral-200 object-cover" />
                  </div>
                </div>
              ) : (
                <ProofImage task={detailTask} />
              )}

              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-neutral-400">Created</p>
                  <p className="font-medium">{format(new Date(detailTask.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Attempts</p>
                  <p className="font-medium">
                    {submission?.attemptNumber ?? 0}
                    {detailTask.maxResubmissions != null && ` / ${detailTask.maxResubmissions}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Recurring</p>
                  <p className="font-medium">{detailTask.isRecurring ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Assignee</p>
                  <p className="font-medium">{isAssignee ? 'You' : assigneeName}</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <SubmissionTimeline history={history} loading={historyLoading} />
            </div>
          )}

          {tab === 'discussion' && (
            <ChoreFeed
              taskId={detailTask.id}
              feed={feed}
              loading={feedLoading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRefresh={loadFeed}
              hideSubmissionItems
            />
          )}
        </div>
      )}
    </Modal>
  );
}
