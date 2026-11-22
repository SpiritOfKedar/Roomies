'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/Modal';
import DueDateTimeField from '@/components/turns/DueDateTimeField';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { splitDeadline, toDeadlineISO, END_OF_DAY, type TimeOfDay } from '@/lib/deadline';
import type { HouseMember, Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
  task: Task;
  members: HouseMember[];
  onSaved: () => void;
}

/** Admin: change this turn's title, assignee, deadline, points or fine. */
export default function EditTurnModal({ open, onClose, houseId, task, members, onSaved }: Props) {
  const [title, setTitle] = useState(task.title);
  const [assignee, setAssignee] = useState(task.assignedTo);
  const [date, setDate] = useState('');
  const [time, setTime] = useState<TimeOfDay>(END_OF_DAY);
  const [reward, setReward] = useState(task.rewardPoints);
  const [fine, setFine] = useState(String(Number(task.penaltyFine)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const due = splitDeadline(task.deadline);
    setTitle(task.title);
    setAssignee(task.assignedTo);
    setDate(due.date);
    setTime(due.time);
    setReward(task.rewardPoints);
    setFine(String(Number(task.penaltyFine)));
  }, [open, task]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deadline = toDeadlineISO(date, time);
    const changes: Parameters<typeof tasksApi.update>[2] = {};
    if (title.trim() !== task.title) changes.title = title.trim();
    if (assignee !== task.assignedTo) changes.assignedTo = assignee;
    if (new Date(deadline).getTime() !== new Date(task.deadline).getTime()) {
      if (new Date(deadline) <= new Date()) {
        toast.error('Pick a due time in the future');
        return;
      }
      changes.deadline = deadline;
    }
    if (reward !== task.rewardPoints) changes.rewardPoints = reward;
    if (Number(fine) !== Number(task.penaltyFine)) changes.penaltyFine = Number(fine);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await tasksApi.update(houseId, task.id, changes);
      toast.success('Turn updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit this turn" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {task.status !== 'pending' && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Giving this turn to someone else restarts it: the current proof and votes are cleared.
          </p>
        )}
        <div>
          <label className="label" htmlFor="edit-title">Chore</label>
          <input id="edit-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={200} required />
        </div>
        <div>
          <label className="label" htmlFor="edit-assignee">Whose turn</label>
          <select id="edit-assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {members
              .filter((m) => m.status === 'active' || m.userId === task.assignedTo)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name}
                </option>
              ))}
          </select>
        </div>
        <DueDateTimeField date={date} time={time} onDateChange={setDate} onTimeChange={setTime} minDate={new Date()} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="edit-reward">Points (max 100)</label>
            <input id="edit-reward" className="input" type="number" min={1} max={100} value={reward} onChange={(e) => setReward(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="edit-fine">Fine if missed, ₹ (max 1000)</label>
            <input id="edit-fine" className="input" type="number" min={1} max={1000} step="0.01" value={fine} onChange={(e) => setFine(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={saving || !date}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
