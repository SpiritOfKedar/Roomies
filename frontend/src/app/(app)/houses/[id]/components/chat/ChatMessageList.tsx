'use client';

import { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import type { HouseMember, HouseMessage } from '@/types';
import ChatMessage from './ChatMessage';

interface Props {
  messages: HouseMessage[];
  members: HouseMember[];
  currentUserId?: string;
  isLoading: boolean;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export default function ChatMessageList({
  messages,
  members,
  currentUserId,
  isLoading,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (messages.length > prevCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
            <div className="h-14 w-2/5 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100">
          <span className="text-2xl">💬</span>
        </div>
        <p className="text-base font-semibold text-neutral-800">No messages yet</p>
        <p className="max-w-xs text-sm text-neutral-500">
          Say hello to your housemates. Press Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((msg) => {
          const d = new Date(msg.createdAt);
          const day = dayLabel(d);
          const showDay = day !== lastDay;
          if (showDay) lastDay = day;
          const isMine = msg.userId === currentUserId;
          const senderName =
            msg.user?.name ??
            members.find((m) => m.userId === msg.userId)?.user?.name ??
            'Member';

          return (
            <div key={msg.id}>
              {showDay && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs font-semibold text-neutral-400">{day}</span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>
              )}
              <ChatMessage
                message={msg}
                isMine={isMine}
                senderName={senderName}
                showSender
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
