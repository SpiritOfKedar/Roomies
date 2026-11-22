'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/Modal';
import Select from '@/components/ui/Select';
import SubmitButton from '@/components/ui/SubmitButton';
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
    <Modal open={open} onClose={onClose} title="New chore" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-5">
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

        <div className="flex flex-col items-center rounded-2xl bg-neutral-50 py-4">
          <p className="label">How big is this job?</p>
          <EffortDial
            value={weight}
            onChange={setWeight}
            label="Effort, 1 to 10"
            caption={`${weight * 10} pts when approved · ₹${weight * 5} if missed`}
          />
        </div>

        {repeat && (
          <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
            When a turn ends, the next one goes to whoever is fairest — based on open chores and who did it last.
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton
            status={status}
            className="flex-1"
            disabled={!date || title.trim().length < 2}
            labels={{ running: 'Creating…', done: 'Created', failed: 'Try again' }}
          >
            Create chore
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
