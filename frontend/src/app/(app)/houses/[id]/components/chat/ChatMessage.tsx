'use client';

import { format } from 'date-fns';
import { resolveProofUrl } from '@/lib/proofUrl';
import type { HouseMember, HouseMessage } from '@/types';

interface Props {
  message: HouseMessage;
  isMine: boolean;
  senderName: string;
  showSender: boolean;
}

export default function ChatMessage({ message, isMine, senderName, showSender }: Props) {
  const img = resolveProofUrl(message.imageUrl);
  const time = format(new Date(message.createdAt), 'h:mm a');

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {showSender && !isMine && (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
          {senderName[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      {showSender && isMine && <div className="size-8 shrink-0" />}

      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && showSender && (
          <p className="mb-1 px-1 text-xs font-semibold text-neutral-500">{senderName}</p>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
            isMine
              ? 'rounded-br-md bg-neutral-900 text-white'
              : 'rounded-bl-md border border-neutral-200 bg-white text-neutral-900'
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
          {img && (
            <a href={img} target="_blank" rel="noopener noreferrer" className="mt-2 block">
              <img src={img} alt="Attachment" className="max-h-52 rounded-lg object-cover" />
            </a>
          )}
        </div>
        <p className={`mt-1 px-1 text-[10px] text-neutral-400 ${isMine ? 'text-right' : ''}`}>
          {time}
        </p>
      </div>
    </div>
  );
}
