'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/Modal';
import Select from '@/components/ui/Select';
import SlideToConfirm from '@/components/ui/SlideToConfirm';
import DueDateTimeField from '@/components/turns/DueDateTimeField';
import EffortDial from '@/components/turns/EffortDial';
import { useActionStatus } from '@/hooks/useActionStatus';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { END_OF_DAY, toDeadlineISO, type TimeOfDay } from '@/lib/deadline';
import type { HouseMember } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
  members: HouseMember[];
  onCreated: () => void;
}

const REPEAT_OPTIONS = [
  { value: '', label: 'Does not repeat', tag: 'once' },
  { value: '0 0 * * *', label: 'Every day', tag: 'daily' },
  { value: '0 0 * * 0', label: 'Every week', tag: 'weekly' },
  { value: '0 0 1 * *', label: 'Every month', tag: 'monthly' },
];

export default function NewChoreModal({ open, onClose, houseId, members, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState<TimeOfDay>(END_OF_DAY);
  const [weight, setWeight] = useState(3);
  const [repeat, setRepeat] = useState('');
  const { status, run } = useActionStatus();

  const assigneeOptions = [
    { value: '', label: 'Fairest pick', tag: 'auto' },
    ...members
      .filter((m) => m.status === 'active')
      .map((m) => ({ value: m.userId, label: m.user?.name ?? 'Member', tag: m.role === 'admin' ? 'admin' : undefined })),
  ];

  const reset = () => {
    setTitle('');
    setAssignee('');
    setDate('');
    setTime(END_OF_DAY);
    setWeight(3);
    setRepeat('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deadline = toDeadlineISO(date, time);
    if (new Date(deadline) <= new Date()) {
      toast.error('Pick a due time in the future');
      return;
    }
    try {
      await run(() =>
        tasksApi.assign(houseId, {
          title: title.trim(),
          deadline,
          ...(assignee ? { assignedTo: assignee } : {}),
          weight,
          isRecurring: !!repeat,
          ...(repeat ? { cronSchedule: repeat } : {}),
        }),
      );
      toast.success('Chore created');
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create chore'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New chore"
      size="lg"
      footer={
        // Pinned below the scrolling body so the actions are always visible
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary h-[52px] shrink-0 !rounded-full px-6" onClick={onClose}>
            Cancel
          </button>
          {/* Slide (or Enter on the handle) submits the form, so its validation still runs */}
          <SlideToConfirm
            className="flex-1"
            label={!date ? 'Pick a due date first' : 'Slide to create chore'}
            status={status}
            disabled={!date || title.trim().length < 2}
            onConfirm={() => (document.getElementById('new-chore-form') as HTMLFormElement | null)?.requestSubmit()}
            labels={{ running: 'Creating…', done: 'Created', failed: 'Try again' }}
          />
        </div>
      }
    >
      <form id="new-chore-form" onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="chore-title">What needs doing?</label>
          <input
            id="chore-title"
            className="input"
            placeholder="Clean the fridge"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={2}
            maxLength={200}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Whose turn first?" value={assignee} options={assigneeOptions} onChange={setAssignee} />
          <Select label="Repeat" value={repeat} options={REPEAT_OPTIONS} onChange={setRepeat} />
        </div>

        <DueDateTimeField date={date} time={time} onDateChange={setDate} onTimeChange={setTime} minDate={new Date()} />

        {/* Compact: dial beside its explanation, not a tall block of its own */}
        <div className="flex items-center gap-5 rounded-2xl bg-neutral-50 px-5 py-3">
          <EffortDial value={weight} onChange={setWeight} label="Effort, 1 to 10" size={112} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">How big is this job?</p>
            <p className="mt-1 text-sm text-neutral-600">
              <span className="font-semibold text-emerald-600">{weight * 10} pts</span> when approved ·{' '}
              <span className="font-semibold text-red-600">₹{weight * 5}</span> if missed
            </p>
            <p className="mt-1 text-xs text-neutral-400">Drag the dial, or focus it and use the arrow keys.</p>
          </div>
        </div>

        {repeat && (
          <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
            When a turn ends, the next one goes to whoever is fairest, based on open chores and who did it last.
          </p>
        )}
      </form>
    </Modal>
  );
}
