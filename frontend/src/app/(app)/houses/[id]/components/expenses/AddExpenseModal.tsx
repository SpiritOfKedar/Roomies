'use client';

import Modal from '@/components/Modal';
import FileUpload from '@/components/ui/FileUpload';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: string;
  receipt: File | null;
  adding: boolean;
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
  adding,
  onTitleChange,
  onAmountChange,
  onReceiptChange,
  onSubmit,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Add Expense">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Description</label>
          <input
            className="input"
            placeholder="Groceries, utilities, rent…"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Amount (₹)</label>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            required
          />
        </div>
        <FileUpload
          label="Receipt (optional)"
          accept="image/*,application/pdf"
          file={receipt}
          onChange={onReceiptChange}
          hint="Split equally across all active members"
        />
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={adding}>
            {adding ? 'Adding…' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
