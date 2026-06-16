'use client';

import { useRef } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/Icon';

interface FileUploadProps {
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}

export default function FileUpload({
  accept = 'image/*',
  file,
  onChange,
  label,
  hint,
  compact = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-semibold text-neutral-800">{label}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50',
            compact ? 'px-3 py-2' : 'px-4 py-3',
          )}
        >
          <Icon name="image" size={18} className="shrink-0 text-neutral-500" />
          <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100',
            compact ? 'px-3 py-2' : 'px-4 py-3',
          )}
        >
          <Icon name="upload" size={16} />
          Attach file
        </button>
      )}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
