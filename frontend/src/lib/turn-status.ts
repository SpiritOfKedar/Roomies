/**
 * Turn status — what a chore turn means *to the person looking at it*.
 *
 * The backend speaks in states (pending / submitted / disputed / …). People
 * think in "what do I need to do?". Everything in the task UI goes through
 * describeTurn() so the wording and the one primary action stay consistent.
 */

import type { Chore, HouseMember, Task, TaskVoteStatus } from '@/types';
import { dueSummary } from './deadline';

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';
export type TurnAction = 'submit' | 'review' | 'resubmit' | null;

export const OPEN_STATUSES = ['pending', 'submitted', 'disputed'] as const;

export function isOpen(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export interface TurnView {
  /** Short chip text, e.g. "Needs your review" */
  label: string;
  tone: Tone;
  /** One line for this viewer, e.g. "Jane's turn · due in 2 days" */
  sentence: string;
  /** The single thing this viewer should do, if anything */
  action: TurnAction;
  actionLabel?: string;
  isMine: boolean;
}

export function firstName(name?: string | null): string {
  return name?.split(' ')[0] ?? 'Someone';
}

export function memberName(members: HouseMember[], userId: string): string {
  return members.find((m) => m.userId === userId)?.user?.name ?? 'Someone';
}

/** Active members who can vote on this turn but haven't yet. */
export function pendingVoters(
  task: Pick<Task, 'assignedTo'>,
  members: HouseMember[],
  vote?: TaskVoteStatus | null,
): HouseMember[] {
  const voted = new Set((vote?.votes ?? []).map((v) => v.userId));
  return members.filter(
    (m) => m.status === 'active' && m.userId !== task.assignedTo && !voted.has(m.userId),
  );
}

export function listNames(people: string[]): string {
  if (people.length === 0) return '';
  if (people.length === 1) return people[0];
  return `${people.slice(0, -1).join(', ')} and ${people[people.length - 1]}`;
}

export function describeTurn(
  task: Task,
  viewerId: string | undefined,
  members: HouseMember[],
  vote?: TaskVoteStatus | null,
): TurnView {
  const isMine = task.assignedTo === viewerId;
  const who = isMine ? 'Your' : `${firstName(memberName(members, task.assignedTo))}'s`;
  const due = task.deadline ? dueSummary(task.deadline) : '';
  const viewerActive = members.some((m) => m.userId === viewerId && m.status === 'active');

  switch (task.status) {
    case 'pending':
      return isMine
        ? { label: 'To do', tone: 'neutral', sentence: `Your turn · ${due}`, action: 'submit', actionLabel: 'Mark done', isMine }
        : { label: 'To do', tone: 'neutral', sentence: `${who} turn · ${due}`, action: null, isMine };

    case 'submitted': {
      const approved = vote?.tallies.approved ?? 0;
      const required = vote?.tallies.required ?? 0;
      const progress = required ? ` · ${approved} of ${required} approvals` : '';
      if (isMine) {
        return { label: 'In review', tone: 'info', sentence: `Waiting for your housemates${progress}`, action: null, isMine };
      }
      if (viewerActive && !vote?.userVote) {
        return {
          label: 'Needs your review',
          tone: 'info',
          sentence: `${who} proof is waiting on you`,
          action: 'review',
          actionLabel: 'Review',
          isMine,
        };
      }
      const waiting = pendingVoters(task, members, vote).map((m) => firstName(m.user?.name));
      return {
        label: 'In review',
        tone: 'info',
        sentence: waiting.length ? `Waiting on ${listNames(waiting)}${progress}` : `In review${progress}`,
        action: null,
        isMine,
      };
    }

    case 'disputed':
      return isMine
        ? {
            label: 'Changes requested',
            tone: 'warning',
            sentence: `Your housemates asked for changes · ${due}`,
            action: 'resubmit',
            actionLabel: 'Fix it',
            isMine,
          }
        : { label: 'Changes requested', tone: 'warning', sentence: `${who} fixing it · ${due}`, action: null, isMine };

    case 'completed':
      return { label: 'Done', tone: 'success', sentence: isMine ? 'You finished this' : `${who} turn is done`, action: null, isMine };
    case 'expired':
      return { label: 'Missed', tone: 'danger', sentence: `${who} turn was missed`, action: null, isMine };
    case 'rejected':
      return { label: 'Failed', tone: 'danger', sentence: `${who} turn failed review`, action: null, isMine };
    default:
      return { label: task.status, tone: 'neutral', sentence: '', action: null, isMine };
  }
}

export interface NeedsYou {
  /** Your turns still to do (pending), plus ones you've handed in (submitted) */
  myTurns: { chore: Chore; task: Task }[];
  toReview: { chore: Chore; task: Task }[];
  toFix: { chore: Chore; task: Task }[];
  /** Items that genuinely need the viewer to act */
  count: number;
}

/** Everything in a house that is waiting on this viewer. */
export function computeNeedsYou(
  chores: Chore[],
  voteStatuses: Record<string, TaskVoteStatus>,
  viewerId: string | undefined,
  members: HouseMember[],
): NeedsYou {
  const myTurns: NeedsYou['myTurns'] = [];
  const toReview: NeedsYou['toReview'] = [];
  const toFix: NeedsYou['toFix'] = [];

  for (const chore of chores) {
    const task = chore.activeInstance;
    if (!task || !isOpen(task.status)) continue;
    const view = describeTurn(task, viewerId, members, voteStatuses[task.id]);
    if (view.action === 'review') toReview.push({ chore, task });
    else if (view.action === 'resubmit') toFix.push({ chore, task });
    else if (view.isMine && (task.status === 'pending' || task.status === 'submitted')) {
      myTurns.push({ chore, task });
    }
  }

  // Due soonest first; already-handed-in turns sink to the bottom.
  myTurns.sort((a, b) =>
    a.task.status === b.task.status
      ? +new Date(a.task.deadline) - +new Date(b.task.deadline)
      : a.task.status === 'pending' ? -1 : 1,
  );

  const todo = myTurns.filter((t) => t.task.status === 'pending').length;
  return { myTurns, toReview, toFix, count: todo + toReview.length + toFix.length };
}

const CRON_LABELS: Record<string, string> = {
  '0 0 * * *': 'Repeats daily',
  '0 0 * * 0': 'Repeats weekly',
  '0 0 1 * *': 'Repeats monthly',
};

export function scheduleLabel(isRecurring: boolean, cron?: string | null): string {
  if (!isRecurring) return 'One-off chore';
  return (cron && CRON_LABELS[cron]) ?? 'Repeats after each turn';
}
