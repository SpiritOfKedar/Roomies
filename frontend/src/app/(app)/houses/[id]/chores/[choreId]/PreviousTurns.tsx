'use client';

import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import StatusChip from '@/components/turns/StatusChip';
import { resolveProofUrl } from '@/lib/proofUrl';
import { listNames, firstName, type Tone } from '@/lib/turn-status';
import type { ChoreThreadCycle } from '@/types';

const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  completed: { label: 'Done', tone: 'success' },
  expired: { label: 'Missed', tone: 'danger' },
  rejected: { label: 'Failed', tone: 'danger' },
  pending: { label: 'To do', tone: 'neutral' },
  submitted: { label: 'In review', tone: 'info' },
  disputed: { label: 'Changes requested', tone: 'warning' },
};

/** Past turns, newest first, collapsed to one line each. */
export default function PreviousTurns({ cycles }: { cycles: ChoreThreadCycle[] }) {
  if (cycles.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {cycles.map((c) => {
        const outcome = OUTCOME[c.status] ?? { label: c.status, tone: 'neutral' as Tone };
        const last = c.submissions[c.submissions.length - 1];
        const url = resolveProofUrl(last?.imageUrl);
        const approvers = (last?.votes ?? []).filter((v) => v.vote === 'approve').map((v) => firstName(v.userName));
        return (
          <li key={c.instanceId}>
            <details className="group rounded-xl border border-neutral-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-neutral-900">{c.assigneeName}</span>
                <span className="text-sm text-neutral-500">{format(new Date(c.deadline), 'd MMM yyyy')}</span>
                <StatusChip label={outcome.label} tone={outcome.tone} className="ml-auto" />
                <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-sm text-neutral-700">
                <p>
                  Turn {c.cycleNumber} · {c.submissions.length} {c.submissions.length === 1 ? 'submission' : 'submissions'}
                  {approvers.length > 0 && ` · approved by ${listNames(approvers)}`}
                </p>
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Final proof for turn ${c.cycleNumber}`} className="max-h-48 w-fit rounded-lg border border-neutral-200 object-cover" />
                )}
                {last?.clarification && <p className="text-neutral-600">“{last.clarification}”</p>}
                {!last && <p className="text-neutral-500">No proof was handed in.</p>}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
