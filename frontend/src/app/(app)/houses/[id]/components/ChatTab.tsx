'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { messagesApi } from '@/lib/endpoints';
import type { HouseMessage, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { resolveProofUrl } from '@/lib/proofUrl';
import toast from 'react-hot-toast';

interface Props {
  houseId: string;
  members: HouseMember[];
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export default function ChatTab({ houseId, members }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<HouseMessage[]>([]);
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await messagesApi.list(houseId, 80);
      setMessages(res.data.data ?? []);
    } catch {
      /* ignore poll errors */
    }
  }, [houseId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', body.trim());
      if (image) fd.append('image', image);
      const res = await messagesApi.send(houseId, fd);
      setMessages((prev) => [...prev, res.data.data]);
      setBody('');
      setImage(null);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  let lastDay = '';

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[400px] flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-500">
            No messages yet. Say hello to your housemates.
          </p>
        )}
        {messages.map((msg) => {
          const d = new Date(msg.createdAt);
          const day = dayLabel(d);
          const showDay = day !== lastDay;
          if (showDay) lastDay = day;
          const isMine = msg.userId === user?.id;
          const img = resolveProofUrl(msg.imageUrl);

          return (
            <div key={msg.id}>
              {showDay && (
                <p className="my-4 text-center text-xs font-semibold text-neutral-400">{day}</p>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    isMine ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-900'
                  }`}
                >
                  {!isMine && (
                    <p className="mb-0.5 text-xs font-bold opacity-70">
                      {msg.user?.name ?? members.find((m) => m.userId === msg.userId)?.user?.name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                  {img && (
                    <img src={img} alt="" className="mt-2 max-h-48 rounded-lg object-cover" />
                  )}
                  <p
                    className={`mt-1 text-[10px] ${isMine ? 'text-neutral-400' : 'text-neutral-500'}`}
                  >
                    {format(d, 'h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="border-t border-neutral-200 p-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <textarea
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          placeholder="Message your house…"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="max-w-[120px] text-xs"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
