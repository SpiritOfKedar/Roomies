'use client';

import Modal from '@/components/Modal';
import FileUpload from '@/components/ui/FileUpload';
import SubmitButton from '@/components/ui/SubmitButton';
import type { ActionStatus } from '@/hooks/useActionStatus';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: string;
  receipt: File | null;
  status: ActionStatus;
  /** Active members the cost is split between, for the preview line */
  splitCount: number;
  onTitleChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onReceiptChange: (f: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddExpenseModal({
  open,
  onClose,
  title,
  amount,
  receipt,
  status,
  splitCount,
  onTitleChange,
  onAmountChange,
  onReceiptChange,
  onSubmit,
}: Props) {
  const share = splitCount > 0 && Number(amount) > 0 ? Math.floor((Number(amount) * 100) / splitCount) / 100 : 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an expense"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton
            form="add-expense-form"
            status={status}
            className="flex-1"
            disabled={!title.trim() || !(Number(amount) > 0)}
            labels={{ running: receipt ? 'Uploading receipt…' : 'Adding…', done: 'Added', failed: 'Try again' }}
          >
            Add expense
          </SubmitButton>
        </div>
      }
    >
      <form id="add-expense-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="expense-title">What was it for?</label>
          <input
            id="expense-title"
            className="input"
            placeholder="Groceries, utilities, rent…"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="expense-amount">Amount (₹)</label>
          <input
            id="expense-amount"
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            required
          />
          {share > 0 && (
            <p className="mt-1.5 text-sm text-neutral-500">
              Split {splitCount} ways · about ₹{share.toLocaleString('en-IN')} each
            </p>
          )}
        </div>
        <FileUpload
          label="Receipt (optional)"
          accept="image/jpeg,image/png,image/gif,image/webp"
          file={receipt}
          onChange={onReceiptChange}
          hint="JPEG, PNG, GIF or WebP · up to 5 MB"
        />
      </form>
    </Modal>
  );
}
