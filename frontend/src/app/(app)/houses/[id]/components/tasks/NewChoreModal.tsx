'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/Modal';
import DueDateTimeField from '@/components/turns/DueDateTimeField';
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
  { value: '', label: 'Does not repeat' },
  { value: '0 0 * * *', label: 'Every day' },
  { value: '0 0 * * 0', label: 'Every week' },
  { value: '0 0 1 * *', label: 'Every month' },
];

export default function NewChoreModal({ open, onClose, houseId, members, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState<TimeOfDay>(END_OF_DAY);
  const [weight, setWeight] = useState(1);
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);

  const activeMembers = members.filter((m) => m.status === 'active');

  const reset = () => {
    setTitle('');
    setAssignee('');
    setDate('');
    setTime(END_OF_DAY);
    setWeight(1);
    setRepeat('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deadline = toDeadlineISO(date, time);
    if (new Date(deadline) <= new Date()) {
      toast.error('Pick a due time in the future');
      return;
    }
    setSaving(true);
    try {
      await tasksApi.assign(houseId, {
        title: title.trim(),
        deadline,
        ...(assignee ? { assignedTo: assignee } : {}),
        weight,
        isRecurring: !!repeat,
        ...(repeat ? { cronSchedule: repeat } : {}),
      });
      toast.success('Chore created');
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create chore'));
    } finally {
      setSaving(false);
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
          <div>
            <label className="label" htmlFor="chore-assignee">Whose turn first?</label>
            <select id="chore-assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Fairest pick (automatic)</option>
              {activeMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="chore-repeat">Repeat</label>
            <select id="chore-repeat" className="input" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DueDateTimeField date={date} time={time} onDateChange={setDate} onTimeChange={setTime} minDate={new Date()} />

        <div>
          <label className="label" htmlFor="chore-weight">
            Effort <span className="font-normal text-neutral-500">· {weight * 10} pts, ₹{weight * 5} if missed</span>
          </label>
          <input
            id="chore-weight"
            type="range"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full accent-neutral-900"
          />
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Quick</span>
            <span>Big job</span>
          </div>
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
          <button type="submit" className="btn-primary flex-1" disabled={saving || !date || title.trim().length < 2}>
            {saving ? 'Creating…' : 'Create chore'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
