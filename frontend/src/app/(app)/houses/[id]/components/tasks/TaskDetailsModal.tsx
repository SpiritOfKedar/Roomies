'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '@/components/Modal';
import { tasksApi } from '@/lib/endpoints';
import type { Task, TaskHistory, TaskVoteStatus, HouseMember } from '@/types';
import VoteProgressBar from './VoteProgressBar';
import SubmissionTimeline from './SubmissionTimeline';
import { useTaskPolling } from '@/hooks/useTaskPolling';

interface Props {
  task: Task | null;
  houseId: string;
  members: HouseMember[];
  currentUserId?: string;
  onClose: () => void;
  onSubmitProof: () => void;
  onResubmit: () => void;
  onVote: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    submitted: 'bg-blue-50 text-blue-700 ring-blue-500/30',
    completed: 'bg-green-50 text-green-700 ring-green-600/20',
    disputed: 'bg-amber-50 text-amber-800 ring-amber-500/30',
    rejected: 'bg-red-50 text-red-700 ring-red-600/10',
    expired: 'bg-orange-50 text-orange-700 ring-orange-500/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${
        styles[status] ?? styles.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function TaskDetailsModal({
  task,
  houseId,
  members,
  currentUserId,
  onClose,
  onSubmitProof,
  onResubmit,
  onVote,
}: Props) {
  const [history, setHistory] = useState<TaskHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voteStatus, setVoteStatus] = useState<TaskVoteStatus | null>(null);

  const isAssignee = task?.assignedTo === currentUserId;
  const proofUrl = task?.currentSubmission?.imageUrl ?? task?.imageUrl;

  useTaskPolling(
    task?.id ?? null,
    !!task && task.status === 'submitted',
    setVoteStatus,
  );

  useEffect(() => {
    if (!task) {
      setHistory(null);
      return;
    }
    setHistoryLoading(true);
    tasksApi
      .getHistory(task.id)
      .then((res) => setHistory(res.data.data))
      .catch(() => setHistory(null))
      .finally(() => setHistoryLoading(false));

    if (task.status === 'submitted') {
      tasksApi.getVotes(task.id).then((res) => setVoteStatus(res.data.data)).catch(() => {});
    } else {
      setVoteStatus(null);
    }
  }, [task?.id, task?.status]);

  return (
    <Modal open={!!task} onClose={onClose} title="Task Details" size="lg">
      {task && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <p className="font-medium text-neutral-500">Task Title</p>
              <p className="font-semibold text-neutral-900">{task.title}</p>
            </div>
            <div>
              <p className="font-medium text-neutral-500">Status</p>
              <div className="mt-1">
                <StatusBadge status={task.status} />
              </div>
            </div>
            <div className="col-span-2">
              <p className="font-medium text-neutral-500">Assigned To</p>
              <p className="font-semibold text-neutral-900">
                {members.find((m) => m.userId === task.assignedTo)?.user?.name ??
                  task.assignee?.name ??
                  '—'}
              </p>
            </div>
            <div>
              <p className="font-medium text-neutral-500">Deadline</p>
              <p className="text-neutral-700">
                {task.deadline ? format(new Date(task.deadline), 'MMM d, yyyy') : '—'}
              </p>
            </div>
            <div>
              <p className="font-medium text-neutral-500">Rewards</p>
              <p className="text-neutral-700">{task.rewardPoints ?? 10} points</p>
            </div>
          </div>

          {task.status === 'submitted' && (
            <VoteProgressBar voteStatus={voteStatus} />
          )}

          {proofUrl && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-500">Current Proof</p>
              <div className="overflow-hidden rounded-lg border border-neutral-200">
                <img src={proofUrl} alt="Task proof" className="max-h-48 w-full object-cover" />
              </div>
            </div>
          )}

          <div>
            <p className="mb-3 text-sm font-semibold text-neutral-800">Submission History</p>
            <SubmissionTimeline history={history} loading={historyLoading} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-neutral-100 px-5 py-2 font-semibold text-neutral-800 hover:bg-neutral-200"
            >
              Close
            </button>
            {isAssignee && task.status === 'pending' && (
              <button
                type="button"
                onClick={onSubmitProof}
                className="rounded-lg bg-black px-5 py-2 font-semibold text-white hover:bg-neutral-800"
              >
                Submit Proof
              </button>
            )}
            {isAssignee && task.status === 'disputed' && (
              <button
                type="button"
                onClick={onResubmit}
                className="rounded-lg bg-amber-600 px-5 py-2 font-semibold text-white hover:bg-amber-700"
              >
                Resubmit Proof
              </button>
            )}
            {!isAssignee && task.status === 'submitted' && (
              <button
                type="button"
                onClick={onVote}
                className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
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
