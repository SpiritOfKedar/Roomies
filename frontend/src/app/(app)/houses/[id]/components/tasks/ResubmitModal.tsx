'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { tasksApi } from '@/lib/endpoints';
import type { Task } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  task: Task | null;
  houseId: string;
  maxResubmissions?: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ResubmitModal({
  task,
  houseId,
  maxResubmissions = 3,
  onClose,
  onSubmitted,
}: Props) {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [clarification, setClarification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const attemptNumber = task?.currentSubmission?.attemptNumber ?? 0;
  const attemptsRemaining = Math.max(0, maxResubmissions - attemptNumber);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!clarification.trim()) {
      toast.error('Please add clarification explaining your resubmission');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (proofFile) fd.append('proof', proofFile);
      fd.append('note', clarification.trim());
      await tasksApi.submit(houseId, task.id, fd);
      toast.success('Proof resubmitted — a new voting round has started');
      onSubmitted();
      onClose();
      setProofFile(null);
      setClarification('');
    } catch {
      toast.error('Failed to resubmit proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!task} onClose={onClose} title="Resubmit Proof" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Your submission was disputed</p>
          <p className="mt-1 text-sm text-amber-800">
            Re-upload your proof with additional clarification. A new voting round will start
            automatically after you submit.
          </p>
          <p className="mt-2 text-xs font-medium text-amber-700">
            {attemptsRemaining} resubmission attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            (max {maxResubmissions})
          </p>
        </div>

        <p className="text-sm text-neutral-500">
          Task: <span className="font-semibold text-black">{task?.title}</span>
        </p>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-800">
            Updated proof image
          </label>
          <input
            className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-700"
            type="file"
            accept="image/*"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-800">
            Clarification <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
            rows={4}
            required
            placeholder="Explain what you changed or why the proof should be accepted…"
            value={clarification}
            onChange={(e) => setClarification(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-lg bg-neutral-100 py-2 font-semibold text-neutral-700 hover:bg-neutral-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-black py-2 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Resubmit & Start New Vote'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
