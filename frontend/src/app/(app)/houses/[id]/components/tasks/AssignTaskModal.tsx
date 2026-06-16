'use client';

import Modal from '@/components/Modal';
import DatePicker from '@/components/ui/DatePicker';
import type { HouseMember } from '@/types';

export interface AssignTaskFormState {
  title: string;
  description: string;
  assignUser: string;
  dueDate: string;
  weight: number;
  isRecurring: boolean;
  cronSchedule: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  members: HouseMember[];
  state: AssignTaskFormState;
  assigning: boolean;
  onChange: <K extends keyof AssignTaskFormState>(key: K, value: AssignTaskFormState[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AssignTaskModal({
  open,
  onClose,
  members,
  state,
  assigning,
  onChange,
  onSubmit,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Assign Task" size="lg">
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-semibold text-neutral-800">Title</label>
          <input
            className="input"
            placeholder="Clean the kitchen"
            value={state.title}
            onChange={(e) => onChange('title', e.target.value)}
            required
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-semibold text-neutral-800">Description</label>
          <textarea
            className="input min-h-[80px] resize-none py-2"
            rows={2}
            placeholder="Optional details for housemates…"
            value={state.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-800">Assign To</label>
          <select
            className="input"
            value={state.assignUser}
            onChange={(e) => onChange('assignUser', e.target.value)}
          >
            <option value="">Auto Assign (Fair Rotation)</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <DatePicker
            label="Due Date"
            value={state.dueDate}
            onChange={(v) => onChange('dueDate', v)}
            placeholder="Select due date"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-800">Weight (points)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={10}
            value={state.weight}
            onChange={(e) => onChange('weight', Number(e.target.value))}
          />
        </div>
        <div className="col-span-2 mt-1 flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <input
            type="checkbox"
            id="isRecurring"
            checked={state.isRecurring}
            onChange={(e) => onChange('isRecurring', e.target.checked)}
            className="mt-0.5 rounded border-neutral-300"
          />
          <label htmlFor="isRecurring" className="text-sm">
            <span className="font-semibold text-neutral-900">Recurring chore</span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Auto-rotates to the next fair housemate when completed
            </span>
          </label>
        </div>
        {state.isRecurring && (
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Repeat</label>
            <select
              className="input"
              value={state.cronSchedule}
              onChange={(e) => onChange('cronSchedule', e.target.value)}
              required={state.isRecurring}
            >
              <option value="">Select frequency…</option>
              <option value="0 0 * * *">Daily</option>
              <option value="0 0 * * 0">Weekly</option>
              <option value="0 0 1 * *">Monthly</option>
            </select>
          </div>
        )}
        <div className="col-span-2 mt-2 flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={assigning || !state.dueDate}>
            {assigning ? 'Assigning…' : 'Assign Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
