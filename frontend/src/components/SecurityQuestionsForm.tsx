'use client';

import { useState } from 'react';
import { usersApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import type { RecoveryStatus, SecurityQuestionOption } from '@/types';
import Select from '@/components/ui/Select';
import SubmitButton from '@/components/ui/SubmitButton';
import SlideToConfirm from '@/components/ui/SlideToConfirm';

interface QuestionRow {
  questionId: string;
  answer: string;
}

interface SecurityQuestionsFormProps {
  status: RecoveryStatus;
  onSaved: () => void;
}

const emptyRows = (): QuestionRow[] => [
  { questionId: '', answer: '' },
  { questionId: '', answer: '' },
  { questionId: '', answer: '' },
];

export function SecurityQuestionsForm({ status, onSaved }: SecurityQuestionsFormProps) {
  const [rows, setRows] = useState<QuestionRow[]>(emptyRows);
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiresPassword = status.hasPassword;

  const updateRow = (index: number, patch: Partial<QuestionRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const questionIds = rows.map((r) => r.questionId);
    if (questionIds.some((id) => !id) || rows.some((r) => r.answer.trim().length < 3)) {
      setError('Choose 3 questions and provide answers of at least 3 characters each.');
      setLoading(false);
      return;
    }
    if (new Set(questionIds).size !== 3) {
      setError('Each security question must be unique.');
      setLoading(false);
      return;
    }
    if (requiresPassword && !currentPassword) {
      setError('Enter your current password to save security questions.');
      setLoading(false);
      return;
    }

    try {
      await usersApi.setSecurityQuestions(
        rows.map((r) => ({ questionId: r.questionId, answer: r.answer })),
        requiresPassword ? currentPassword : undefined,
      );
      setSuccess('Security questions saved.');
      setCurrentPassword('');
      setRows(emptyRows());
      onSaved();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to save security questions.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (requiresPassword && !currentPassword) {
      setError('Enter your current password to remove security questions.');
      return;
    }
    // Confirmation is the slide gesture itself (no browser confirm dialog).
    setRemoving(true);
    setError(null);
    setSuccess(null);
    try {
      await usersApi.deleteSecurityQuestions(requiresPassword ? currentPassword : undefined);
      setSuccess('Security questions removed.');
      setCurrentPassword('');
      onSaved();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to remove security questions.'));
    } finally {
      setRemoving(false);
    }
  };

  const availableForRow = (index: number): SecurityQuestionOption[] => {
    const selectedElsewhere = new Set(
      rows.map((r, i) => (i === index ? '' : r.questionId)).filter(Boolean),
    );
    return status.availableQuestions.filter((q) => !selectedElsewhere.has(q.questionId));
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {rows.map((row, index) => (
        <div key={index} className="space-y-2">
          <Select
            label={`Question ${index + 1}`}
            value={row.questionId}
            onChange={(v) => updateRow(index, { questionId: v })}
            placeholder="Pick a question"
            options={availableForRow(index).map((q) => ({ value: q.questionId, label: q.text }))}
          />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#374151]">Your answer</span>
            <input
              className="h-11 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm text-[#111827] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
              type="text"
              value={row.answer}
              onChange={(e) => updateRow(index, { answer: e.target.value })}
              placeholder="Answer (min 3 characters)"
              required
              minLength={3}
            />
          </label>
        </div>
      ))}

      {requiresPassword && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[#111827]">Current password</span>
          <input
            className="h-11 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm text-[#111827] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Required to save or remove questions"
          />
        </label>
      )}

      <div className="pt-2">
        <SubmitButton
          status={loading ? 'running' : 'idle'}
          labels={{ running: 'Saving…' }}
        >
          {status.hasSecurityQuestions ? 'Update questions' : 'Save questions'}
        </SubmitButton>
      </div>
      {status.hasSecurityQuestions && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-sm font-semibold text-neutral-900">Remove security questions</p>
          <p className="mt-1 text-sm text-neutral-500">You won&apos;t be able to recover your account with questions any more.</p>
          <SlideToConfirm
            className="mt-3"
            label="Slide to remove questions"
            status={removing ? 'running' : 'idle'}
            onConfirm={handleRemove}
            labels={{ running: 'Removing…' }}
          />
        </div>
      )}
    </form>
  );
}
