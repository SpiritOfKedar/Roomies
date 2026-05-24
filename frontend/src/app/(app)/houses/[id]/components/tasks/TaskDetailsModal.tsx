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
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  pending: { badge: 'bg-neutral-100 text-neutral-700', dot: 'bg-neutral-400' },
  submitted: { badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  completed: { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  disputed: { badge: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  rejected: { badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  expired: { badge: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
};

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="text-sm font-medium text-neutral-900">{children}</div>
    </div>
  );
}

function MetaItemFixed({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="text-sm font-medium text-neutral-900">{children}</div>
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
}: Props) {
  const [detailTask, setDetailTask] = useState<Task | null>(task);
  const [feed, setFeed] = useState<TaskFeed | null>(null);
  const [history, setHistory] = useState<TaskHistory | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voteStatus, setVoteStatus] = useState<TaskVoteStatus | null>(null);

  const isAssignee = detailTask?.assignedTo === currentUserId;
  const proof = resolveTaskProofUrl(detailTask);
  const statusStyle = STATUS_STYLES[detailTask?.status ?? 'pending'] ?? STATUS_STYLES.pending;

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
  const hasSubmissionMeta = Boolean(submission || detailTask?.status === 'submitted' || detailTask?.status === 'disputed');

  return (
    <Modal open={!!task} onClose={onClose} title="" size="lg">
      {detailTask && (
        <div className="flex flex-col gap-8 -mt-2">
          {/* Header */}
          <div className="space-y-4 border-b border-neutral-100 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">{detailTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.badge}`}
                  >
                    <span className={`size-1.5 rounded-full ${statusStyle.dot}`} />
                    {detailTask.status.charAt(0).toUpperCase() + detailTask.status.slice(1)}
                  </span>
                  {detailTask.isRecurring && (
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      Recurring
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">+{detailTask.rewardPoints ?? 10}</p>
                <p className="text-xs text-neutral-400">reward points</p>
                {Number(detailTask.penaltyFine) > 0 && (
                  <p className="mt-1 text-sm font-medium text-red-500">−${detailTask.penaltyFine} penalty</p>
                )}
              </div>
            </div>
          </div>

          {/* Task overview grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem label="Assigned to">
              {isAssignee ? 'You' : assigneeName}
              {assigneeMember?.role && (
                <span className="ml-1.5 text-xs font-normal capitalize text-neutral-400">
                  ({assigneeMember.role})
                </span>
              )}
            </MetaItem>
            <MetaItem label="Deadline">
              {detailTask.deadline
                ? format(new Date(detailTask.deadline), 'MMM d, yyyy · h:mm a')
                : '—'}
            </MetaItem>
            <MetaItem label="Created">
              {format(new Date(detailTask.createdAt), 'MMM d, yyyy')}
            </MetaItem>
            <MetaItem label="Attempts">
              {submission?.attemptNumber ?? 0}
              {detailTask.maxResubmissions != null && (
                <span className="text-neutral-400"> / {detailTask.maxResubmissions} max</span>
              )}
            </MetaItem>
          </div>

          {/* Submission metadata */}
          {hasSubmissionMeta && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Latest Submission
              </h3>
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetaItemFixed label="Submitted by">
                      {assigneeName}
                      {assigneeMember?.role && (
                        <p className="mt-0.5 text-xs font-normal capitalize text-neutral-500">
                          {assigneeMember.role}
                        </p>
                      )}
                    </MetaItemFixed>
                    <MetaItemFixed label="Submitted at">
                      {submission?.createdAt ? (
                        <>
                          {format(new Date(submission.createdAt), 'MMM d, yyyy · h:mm a')}
                          <p className="mt-0.5 text-xs font-normal text-neutral-500">
                            {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </MetaItemFixed>
                  </div>
                  {submission?.clarification && (
                    <MetaItemFixed label="Note">
                      <p className="font-normal leading-relaxed text-neutral-700">{submission.clarification}</p>
                    </MetaItemFixed>
                  )}
                  {detailTask.status === 'submitted' && (
                    <VoteProgressBar voteStatus={voteStatus} />
                  )}
                  {voteStatus?.userVote && (
                    <p className="text-sm font-medium text-emerald-700">
                      You voted: <span className="capitalize">{voteStatus.userVote.vote}</span>
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Proof image</p>
                  {proof.url ? (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                      <img
                        src={proof.url}
                        alt="Task proof"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                  ) : proof.legacy ? (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-center text-sm text-neutral-500">
                      Proof unavailable (legacy upload)
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-center text-sm text-neutral-500">
                      No proof image attached
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Proof for pending tasks with prior image */}
          {!hasSubmissionMeta && proof.url && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Proof</h3>
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <img src={proof.url} alt="Task proof" className="max-h-64 w-full object-cover" />
              </div>
            </div>
          )}

          {/* Submission history */}
          {(history?.rounds.length ?? 0) > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Submission History
              </h3>
              <SubmissionTimeline history={history} loading={historyLoading} />
            </div>
          )}

          {/* Activity feed */}
          <div className="space-y-4 border-t border-neutral-100 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Activity & Discussion
            </h3>
            <ChoreFeed
              taskId={detailTask.id}
              feed={feed}
              loading={feedLoading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRefresh={loadFeed}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-6">
            {canAdminEdit && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Edit Task
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
            >
              Close
            </button>
            {isAssignee && detailTask.status === 'pending' && (
              <button
                type="button"
                onClick={onSubmitProof}
                className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Submit Proof
              </button>
            )}
            {isAssignee && detailTask.status === 'disputed' && (
              <button
                type="button"
                onClick={onResubmit}
                className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Resubmit Proof
              </button>
            )}
            {canVote && (
              <button
                type="button"
                onClick={onVote}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Review & Vote
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
