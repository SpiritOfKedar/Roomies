'use client';

import { format } from 'date-fns';
import type { TaskHistory } from '@/types';
import { resolveProofUrl, isLegacyProofUrl } from '@/lib/proofUrl';

interface Props {
  history: TaskHistory | null;
  loading?: boolean;
}

const OUTCOME_STYLES: Record<string, string> = {
  approved: 'text-green-700 bg-green-50',
  disputed: 'text-amber-700 bg-amber-50',
  rejected: 'text-red-700 bg-red-50',
  tie: 'text-orange-700 bg-orange-50',
  voting: 'text-blue-700 bg-blue-50',
};

export default function SubmissionTimeline({ history, loading }: Props) {
  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />;
  }

  if (!history || history.rounds.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">No submission history yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {history.rounds.map((round, idx) => (
        <div key={round.submissionId} className="relative flex gap-4 pb-6 last:pb-0">
          {idx < history.rounds.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-neutral-200" />
          )}
          <div
            className={`relative z-10 mt-1 size-6 shrink-0 rounded-full border-2 ${
              round.isCurrent ? 'border-black bg-black' : 'border-neutral-300 bg-white'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">
                Attempt {round.attemptNumber}
              </span>
              {round.outcome && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                    OUTCOME_STYLES[round.outcome] ?? 'text-neutral-600 bg-neutral-100'
                  }`}
                >
                  {round.outcome}
                </span>
              )}
              <span className="text-xs text-neutral-400">
                {format(new Date(round.submittedAt), 'MMM d, h:mm a')}
              </span>
            </div>

            {round.clarification && (
              <p className="mt-1 text-sm text-neutral-600">{round.clarification}</p>
            )}

            {round.imageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
                {resolveProofUrl(round.imageUrl) ? (
                  <img
                    src={resolveProofUrl(round.imageUrl)!}
                    alt={`Proof attempt ${round.attemptNumber}`}
                    className="max-h-40 w-full object-cover"
                  />
                ) : isLegacyProofUrl(round.imageUrl) ? (
                  <p className="p-3 text-xs text-neutral-500">Proof unavailable (legacy upload)</p>
                ) : null}
              </div>
            )}

            {round.votes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {round.votes.map((v) => (
                  <li key={`${v.userId}-${v.createdAt}`} className="text-xs text-neutral-600">
                    <span className="font-medium">{v.userName}</span>{' '}
                    <span className={v.vote === 'approve' ? 'text-green-600' : 'text-red-600'}>
                      {v.vote}d
                    </span>
                    {v.reason && (
                      <span className="text-neutral-500"> — &quot;{v.reason}&quot;</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
