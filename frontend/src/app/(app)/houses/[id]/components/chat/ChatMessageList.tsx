'use client';

import { useEffect, useRef } from 'react';
import { differenceInMinutes, format, isToday, isYesterday } from 'date-fns';
import type { HouseMember, HouseMessage } from '@/types';
import ChatMessage from './ChatMessage';
import Loader from '@/components/ui/Loader';

interface Props {
  messages: HouseMessage[];
  members: HouseMember[];
  currentUserId?: string;
  isLoading: boolean;
}

/** Messages from one person this close together read as one group. */
const GROUP_MINUTES = 5;

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM');
}

function sameGroup(a: HouseMessage | undefined, b: HouseMessage | undefined) {
  if (!a || !b || a.userId !== b.userId) return false;
  const da = new Date(a.createdAt);
  const db = new Date(b.createdAt);
  return dayLabel(da) === dayLabel(db) && Math.abs(differenceInMinutes(db, da)) < GROUP_MINUTES;
}

export default function ChatMessageList({ messages, members, currentUserId, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (messages.length > prevCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevCount.current === 0 ? 'auto' : 'smooth' });
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader label="Loading messages" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
        <p className="text-base font-semibold text-neutral-900">No messages yet</p>
        <p className="max-w-xs text-sm text-neutral-500">Say hello to your roommates. Everyone in the house sees this chat.</p>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-col">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const day = dayLabel(new Date(msg.createdAt));
          const newDay = !prev || dayLabel(new Date(prev.createdAt)) !== day;
          const first = newDay || !sameGroup(prev, msg);
          const last = !sameGroup(msg, next);
          const senderName =
            msg.user?.name ?? members.find((m) => m.userId === msg.userId)?.user?.name ?? 'Member';

          return (
            <div key={msg.id} className={first ? 'mt-4 first:mt-0' : 'mt-0.5'}>
              {newDay && (
                <div className="mb-4 flex justify-center">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">{day}</span>
                </div>
              )}
              <ChatMessage
                message={msg}
                isMine={msg.userId === currentUserId}
                senderName={senderName}
                firstInGroup={first}
                lastInGroup={last}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
