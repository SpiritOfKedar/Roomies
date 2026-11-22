'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import FileUpload from '@/components/ui/FileUpload';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';

interface Props {
  houseId: string;
  taskId: string;
  /** Resubmitting after "changes requested": a note is required */
  isResubmit?: boolean;
  onDone: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}

/** Photo + note hand-in, shared by the Tasks tab, My Tasks and the chore page. */
export default function SubmitProofForm({
  houseId,
  taskId,
  isResubmit = false,
  onDone,
  onCancel,
  submitLabel,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResubmit && !note.trim()) {
      toast.error('Tell your housemates what you changed');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (file) fd.append('proof', file);
      if (note.trim()) fd.append('clarification', note.trim());
      await tasksApi.submit(houseId, taskId, fd);
      toast.success(isResubmit ? 'Resubmitted for review' : 'Sent for review');
      setFile(null);
      setNote('');
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FileUpload
        file={file}
        onChange={setFile}
        label="Photo of the finished chore"
        hint="JPEG, PNG, GIF or WebP · up to 5 MB"
      />
      <div>
        <label className="label" htmlFor={`note-${taskId}`}>
          {isResubmit ? 'What did you change? *' : 'Note (optional)'}
        </label>
        <textarea
          id={`note-${taskId}`}
          className="input h-auto min-h-[84px] resize-none py-3"
          placeholder={isResubmit ? 'e.g. Cleaned the bottom drawer too' : 'Anything your housemates should know'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required={isResubmit}
          maxLength={1000}
        />
      </div>
      <div className="flex gap-3">
        {onCancel && (
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={saving}>
          {saving ? 'Sending…' : submitLabel ?? (isResubmit ? 'Resubmit for review' : 'Send for review')}
        </button>
      </div>
    </form>
  );
}
