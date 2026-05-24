'use client';

import { format } from 'date-fns';
import type { TaskHistory } from '@/types';
import { resolveProofUrl, isLegacyProofUrl } from '@/lib/proofUrl';

interface Props {
  history: TaskHistory | null;
  loading?: boolean;
}

const OUTCOME_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  disputed: 'bg-amber-50 text-amber-800 ring-amber-500/30',
  rejected: 'bg-red-50 text-red-700 ring-red-600/10',
  tie: 'bg-orange-50 text-orange-700 ring-orange-500/30',
  voting: 'bg-blue-50 text-blue-700 ring-blue-500/30',
};

export default function SubmissionTimeline({ history, loading }: Props) {
  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />;
  }

  if (!history || history.rounds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
        No submission history yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {history.rounds.map((round) => {
        const proofUrl = resolveProofUrl(round.imageUrl);
        const legacy = isLegacyProofUrl(round.imageUrl);

        return (
          <article
            key={round.submissionId}
            className={`rounded-xl border p-4 ${round.isCurrent ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white'}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-neutral-900">Attempt {round.attemptNumber}</h4>
              {round.outcome && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                    OUTCOME_STYLES[round.outcome] ?? 'bg-neutral-100 text-neutral-600 ring-neutral-500/10'
                  }`}
                >
                  {round.outcome}
                </span>
              )}
              {round.isCurrent && (
                <span className="text-xs font-medium text-neutral-500">Current</span>
              )}
              <span className="ml-auto text-xs text-neutral-400">
                {format(new Date(round.submittedAt), 'MMM d, yyyy · h:mm a')}
              </span>
            </div>

            {round.clarification && (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{round.clarification}</p>
            )}

            <div className="mt-3">
              {proofUrl ? (
                <img
                  src={proofUrl}
                  alt={`Proof attempt ${round.attemptNumber}`}
                  className="max-h-56 w-full rounded-lg border border-neutral-200 object-cover"
                />
              ) : legacy ? (
                <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                  Proof unavailable (legacy upload)
                </p>
              ) : round.imageUrl ? (
                <p className="text-sm text-neutral-500">Proof image could not be loaded</p>
              ) : null}
            </div>

            {round.votes.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                {round.votes.map((v) => (
                  <li key={`${v.userId}-${v.createdAt}`} className="flex flex-wrap gap-x-2 text-sm">
                    <span className="font-medium text-neutral-800">{v.userName}</span>
                    <span className={v.vote === 'approve' ? 'text-emerald-600' : 'text-red-600'}>
                      {v.vote}d
                    </span>
                    {v.reason && <span className="text-neutral-500">— {v.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
