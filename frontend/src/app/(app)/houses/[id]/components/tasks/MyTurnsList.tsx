'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import Modal from '@/components/Modal';
import SubmitProofForm from '@/components/turns/SubmitProofForm';
import { TaskItem } from '@/components/ui/rare/task-list';
import { dueSummary } from '@/lib/deadline';
import type { Chore, Task } from '@/types';

interface Props {
  houseId: string;
  turns: { chore: Chore; task: Task }[];
  onChanged: () => void;
}

/**
 * Your own turns as a checklist (Rare UI task item).
 * Ticking an open turn opens the hand-in form; the tick and strike-through only
 * play once the proof is actually sent (the item is controlled by task status),
 * so the checklist never shows something as done that isn't.
 */
export default function MyTurnsList({ houseId, turns, onChanged }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [handingIn, setHandingIn] = useState<{ chore: Chore; task: Task } | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2">
        {turns.map(({ chore, task }) => {
          const handedIn = task.status !== 'pending';
          return (
            <motion.li
              key={task.id}
              layout={!reduced}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
            >
              <TaskItem
                label={chore.title}
                checked={handedIn}
                accent="#10b981"
                size="md"
                className="w-full sm:w-auto sm:min-w-[260px]"
                aria-label={handedIn ? `${chore.title} — sent for review` : `Hand in ${chore.title}`}
                onCheckedChange={() => {
                  if (handedIn) router.push(`/houses/${houseId}/chores/${chore.id}`);
                  else setHandingIn({ chore, task });
                }}
              />
              <span className="pl-1 text-sm text-neutral-500 sm:pl-0">
                {handedIn ? 'Sent for review' : dueSummary(task.deadline)}
                {' · '}
                <button
                  type="button"
                  className="font-semibold text-neutral-700 underline-offset-2 hover:underline"
                  onClick={() => router.push(`/houses/${houseId}/chores/${chore.id}`)}
                >
                  Open
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
