'use client';

import type { TaskVoteStatus } from '@/types';

interface Props {
  voteStatus: TaskVoteStatus | null;
  compact?: boolean;
}

export default function VoteProgressBar({ voteStatus, compact = false }: Props) {
  if (!voteStatus) return null;

  const { tallies, eligibleVoters, votesCast, votingComplete } = voteStatus;
  const total = eligibleVoters || 1;
  const approvePct = Math.round((tallies.approved / total) * 100);
  const rejectPct = Math.round((tallies.rejected / total) * 100);

  return (
    <div className={`flex flex-col gap-2 ${compact ? '' : 'rounded-lg border border-neutral-200 bg-neutral-50 p-4'}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-neutral-800">Vote Progress</span>
        <span className="text-neutral-500">
          {votesCast}/{eligibleVoters} voted
          {votingComplete && (
            <span className="ml-2 text-xs font-medium text-neutral-600">(complete)</span>
          )}
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${approvePct}%` }}
        />
        <div
          className="bg-red-400 transition-all duration-500"
          style={{ width: `${rejectPct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs font-medium">
        <span className="text-green-700">{tallies.approved} approve</span>
        <span className="text-neutral-500">Need {tallies.required} for majority</span>
        <span className="text-red-600">{tallies.rejected} reject</span>
      </div>
    </div>
  );
}
