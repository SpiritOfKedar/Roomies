'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import FileUpload from '@/components/ui/FileUpload';

interface Props {
  onSend: (body: string, image: File | null) => Promise<void>;
  sending: boolean;
}

export default function ChatComposer({ onSend, sending }: Props) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = body.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    const text = body.trim();
    setBody('');
    setImage(null);
    setShowAttach(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSend(text, image);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-white p-3">
      {showAttach && (
        <div className="mb-3">
          <FileUpload file={image} onChange={setImage} compact hint="Images only" />
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowAttach((v) => !v)}
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            showAttach
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
          }`}
          title="Attach image"
        >
          <Icon name="image" size={18} />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={body}
          onChange={onInput}
          onKeyDown={onKeyDown}
          placeholder="Message your house… (Enter to send)"
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />

        <button
          type="button"
          disabled={!canSend}
          onClick={() => void submit()}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          title="Send"
        >
          <Icon name="arrow_forward" size={18} />
        </button>
      </div>
      <p className="mt-2 hidden text-center text-[10px] text-neutral-400 sm:block">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
