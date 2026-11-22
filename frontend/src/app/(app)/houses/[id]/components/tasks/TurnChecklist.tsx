'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import Modal from '@/components/Modal';
import SubmitProofForm from '@/components/turns/SubmitProofForm';
import { TaskItem } from '@/components/ui/rare/task-list';
import { describeTurn, type Tone } from '@/lib/turn-status';
import { cn } from '@/lib/utils';
import type { Chore, HouseMember, Task, TaskVoteStatus } from '@/types';

export interface ChecklistTurn {
  chore: Chore;
  task: Task | null;
}

interface Props {
  houseId: string;
  turns: ChecklistTurn[];
  members: HouseMember[];
  viewerId?: string;
  voteStatuses?: Record<string, TaskVoteStatus>;
  /** Refetch after a hand-in */
  onChanged: () => void;
}

/** Handed in or finished — the tick is filled. Changes requested is back to unticked. */
const TICKED = ['submitted', 'completed'];

const ACCENT: Record<Tone, string> = {
  neutral: '#10b981',
  info: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const ACTION_TONE: Record<Tone, string> = {
  neutral: 'text-neutral-900',
  info: 'text-blue-700',
  warning: 'text-amber-700',
  success: 'text-emerald-700',
  danger: 'text-red-700',
};

/**
 * The one way chores are listed (Rare UI task items): tick = handed in or done.
 * Ticking your own open turn opens the hand-in form; the tick only fills once
 * the proof is actually sent (items are controlled by task status). Anything
 * else opens the chore page, where reviews and fixes happen with full context.
 */
export default function TurnChecklist({ houseId, turns, members, viewerId, voteStatuses = {}, onChanged }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [handingIn, setHandingIn] = useState<{ chore: Chore; task: Task } | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {turns.map(({ chore, task }) => {
          const href = `/houses/${houseId}/chores/${chore.id}`;
          const view = task ? describeTurn(task, viewerId, members, voteStatuses[task.id]) : null;
          const ticked = !!task && TICKED.includes(task.status);
          const canHandIn = !!task && view?.action === 'submit';
          return (
            <motion.li
              key={chore.id}
              layout={!reduced}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
            >
              <TaskItem
                label={chore.title}
                checked={ticked}
                accent={ACCENT[view?.tone ?? 'neutral']}
                size="md"
                className="w-full sm:w-auto sm:min-w-[260px]"
                aria-label={canHandIn ? `Hand in ${chore.title}` : `Open ${chore.title}`}
                onCheckedChange={() => (canHandIn && task ? setHandingIn({ chore, task }) : router.push(href))}
              />
              <span className="pl-1 text-sm text-neutral-500 sm:pl-0">
                {view?.sentence ?? 'No turns yet'}
                {' · '}
                <button
                  type="button"
                  className={cn(
                    'font-semibold underline-offset-2 hover:underline',
                    view?.action ? ACTION_TONE[view.tone] : 'text-neutral-700',
                  )}
                  onClick={() => (canHandIn && task ? setHandingIn({ chore, task }) : router.push(href))}
                >
                  {view?.actionLabel ?? 'Open'}
                </button>
              </span>
            </motion.li>
          );
        })}
      </ul>

      <Modal open={!!handingIn} onClose={() => setHandingIn(null)} title={`Hand in: ${handingIn?.chore.title ?? ''}`}>
        {handingIn && (
          <SubmitProofForm
            houseId={houseId}
            taskId={handingIn.task.id}
            onCancel={() => setHandingIn(null)}
            onDone={() => {
              setHandingIn(null);
              onChanged();
            }}
          />
        )}
      </Modal>
    </>
  );
}
