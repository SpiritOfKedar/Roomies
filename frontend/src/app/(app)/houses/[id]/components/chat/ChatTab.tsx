'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { messagesApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import type { HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import { useChatMessages } from './useChatMessages';

interface Props {
  houseId: string;
  members: HouseMember[];
  isActive?: boolean;
}

/** House chat: fills the tab card edge to edge (no card-in-card). */
export default function ChatTab({ houseId, members, isActive = true }: Props) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const { messages, isLoading, appendMessage } = useChatMessages(houseId, isActive);
  const active = members.filter((m) => m.status === 'active');

  const handleSend = async (body: string, image: File | null) => {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', body);
      if (image) fd.append('image', image);
      const res = await messagesApi.send(houseId, fd);
      appendMessage(res.data.data);
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Message not sent'));
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    // -m-6 cancels the tab card's padding so the chat uses the whole card
    <div className="-m-6 flex h-[min(72vh,680px)] min-h-[440px] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">House chat</h2>
          <p className="text-xs text-neutral-500">
            Everyone in the house · {active.length} {active.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="flex -space-x-2">
          {active.slice(0, 5).map((m) => (
            <span
              key={m.userId}
              title={m.user?.name}
              className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white ring-2 ring-white"
            >
              {m.user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          ))}
        </div>
      </header>

      <ChatMessageList messages={messages} members={members} currentUserId={user?.id} isLoading={isLoading} />

      <ChatComposer onSend={handleSend} sending={sending} />
    </div>
  );
}
