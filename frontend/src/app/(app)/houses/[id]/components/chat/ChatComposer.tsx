'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Resolves true when the message was sent; on failure the text is kept */
  onSend: (body: string, image: File | null) => Promise<boolean>;
  sending: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

/** One rounded field: attach on the left, send on the right, image preview inside. */
export default function ChatComposer({ onSend, sending }: Props) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const canSend = body.trim().length > 0 && !sending;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const submit = async () => {
    if (!canSend) return;
    const ok = await onSend(body.trim(), image);
    if (!ok) return;
    setBody('');
    setImage(null);
    if (fileRef.current) fileRef.current.value = '';
    requestAnimationFrame(resize);
    textareaRef.current?.focus();
  };

  return (
    <div className="shrink-0 border-t border-neutral-100 px-6 py-4">
      <div className="rounded-3xl border border-neutral-200 bg-white transition-colors focus-within:border-neutral-400">
        {preview && (
          <div className="relative ml-3 mt-3 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Image to send" className="h-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-neutral-900 text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1 p-1.5">
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach an image"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <ImagePlus className="size-5" />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              resize();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Message the house"
            aria-label="Message the house. Enter to send, Shift+Enter for a new line"
            className="scrollbar-thin max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-neutral-900 placeholder-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void submit()}
            aria-label="Send"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
              canSend ? 'bg-neutral-900 text-white hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-400',
            )}
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
