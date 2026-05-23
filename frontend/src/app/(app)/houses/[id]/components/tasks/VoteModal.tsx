'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { tasksApi } from '@/lib/endpoints';
import type { Task, TaskVoteStatus } from '@/types';
import toast from 'react-hot-toast';
import VoteProgressBar from './VoteProgressBar';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { resolveProofUrl, isLegacyProofUrl } from '@/lib/proofUrl';

interface Props {
  task: Task | null;
  houseId: string;
  onClose: () => void;
  onVoted: () => void;
}

export default function VoteModal({ task, houseId, onClose, onVoted }: Props) {
  const [rejectReason, setRejectReason] = useState('');
  const [voteStatus, setVoteStatus] = useState<TaskVoteStatus | null>(null);
  const [voting, setVoting] = useState(false);

  useTaskPolling(task?.id ?? null, !!task && !voteStatus?.userVote, setVoteStatus);

  const rawProofUrl = task?.currentSubmission?.imageUrl ?? task?.imageUrl;
  const proofUrl = resolveProofUrl(rawProofUrl);
  const legacyProof = isLegacyProofUrl(rawProofUrl);
  const alreadyVoted = !!voteStatus?.userVote || !!voteStatus?.votingComplete;

  const handleVote = async (vote: 'approve' | 'reject') => {
    if (!task) return;
    setVoting(true);
    try {
      const res = await tasksApi.vote(houseId, task.id, vote, vote === 'reject' ? rejectReason || undefined : undefined);
      const result = res.data.data;
      if (result.finalStatus === 'completed' && result.rotation?.assigneeName) {
        toast.success(
          `Task approved. ${task.title} assigned to ${result.rotation.assigneeName}.`,
        );
      } else if (result.finalStatus === 'completed') {
        toast.success('Task approved!');
      } else if (result.finalStatus === 'disputed') {
        toast.success('Task disputed — assignee will be asked to resubmit');
      } else {
        toast.success('Vote recorded');
      }
      onVoted();
      onClose();
    } catch {
      toast.error('Vote failed');
    } finally {
      setVoting(false);
    }
  };

  return (
    <Modal open={!!task} onClose={onClose} title="Review Proof" size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          Task: <span className="font-semibold text-black">{task?.title}</span>
        </p>

        {task?.currentSubmission?.clarification && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Assignee clarification</p>
            <p>{task.currentSubmission.clarification}</p>
          </div>
        )}

        {proofUrl ? (
          <div className="w-full overflow-hidden rounded-lg border border-neutral-200">
            <img src={proofUrl} alt="Task proof" className="max-h-64 w-full object-cover" />
          </div>
        ) : legacyProof ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
            Proof image unavailable (legacy upload). Ask the assignee to re-upload if needed.
          </p>
        ) : (
          <p className="text-sm italic text-neutral-500">No proof image attached.</p>
        )}

        <VoteProgressBar voteStatus={voteStatus} />

        {alreadyVoted ? (
          <p className="text-sm font-medium text-neutral-600">
            You voted: <span className="capitalize">{voteStatus?.userVote?.vote}</span>
            {voteStatus?.userVote?.reason && ` — "${voteStatus.userVote.reason}"`}
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-800">
                Reject reason (optional)
              </label>
              <textarea
                className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                rows={2}
                placeholder="Explain why the proof is insufficient…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                disabled={voting}
                onClick={() => handleVote('reject')}
                className="flex-1 rounded-lg bg-red-50 py-2 font-semibold text-red-600 transition-all hover:bg-red-600 hover:text-white disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={voting}
                onClick={() => handleVote('approve')}
                className="flex-1 rounded-lg bg-green-50 py-2 font-semibold text-green-700 transition-all hover:bg-green-600 hover:text-white disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
