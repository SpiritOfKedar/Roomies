'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import StatusChip from '@/components/turns/StatusChip';
import { describeTurn, memberName } from '@/lib/turn-status';
import type { Chore, HouseMember, Task, TaskVoteStatus } from '@/types';

interface Props {
  houseId: string;
  chore: Chore;
  task: Task | null;
  members: HouseMember[];
  viewerId?: string;
  vote?: TaskVoteStatus;
}

/** One chore in a list: who, what state, and the single action for this viewer. */
export default function TurnRow({ houseId, chore, task, members, viewerId, vote }: Props) {
  const href = `/houses/${houseId}/chores/${chore.id}`;
  const view = task ? describeTurn(task, viewerId, members, vote) : null;
  const assignee = task ? memberName(members, task.assignedTo) : '';

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-400"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white"
        >
          {assignee[0]?.toUpperCase() ?? '·'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-neutral-900">{chore.title}</span>
          <span className="block truncate text-sm text-neutral-500">{view?.sentence ?? 'No turns yet'}</span>
        </span>
        {view && <StatusChip label={view.label} tone={view.tone} className="hidden sm:inline-flex" />}
        {view?.action ? (
          <span className="btn-primary !px-4 !py-2">{view.actionLabel}</span>
        ) : (
          <ChevronRight className="size-5 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
        )}
      </Link>
    </li>
  );
}
