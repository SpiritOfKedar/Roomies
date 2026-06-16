'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { messagesApi } from '@/lib/endpoints';
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

export default function ChatTab({ houseId, members, isActive = true }: Props) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const { messages, isLoading, appendMessage } = useChatMessages(houseId, isActive);

  const handleSend = async (body: string, image: File | null) => {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('body', body);
      if (image) fd.append('image', image);
      const res = await messagesApi.send(houseId, fd);
      appendMessage(res.data.data);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[min(70vh,640px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
      <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
        <h3 className="text-sm font-bold text-neutral-900">House Chat</h3>
        <p className="text-xs text-neutral-500">{members.length} members in this channel</p>
      </div>

      <ChatMessageList
        messages={messages}
        members={members}
        currentUserId={user?.id}
        isLoading={isLoading}
      />

      <ChatComposer onSend={handleSend} sending={sending} />
    </div>
  );
}
