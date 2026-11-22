'use client';

import { format } from 'date-fns';
import { resolveProofUrl } from '@/lib/proofUrl';
import { cn } from '@/lib/utils';
import type { HouseMessage } from '@/types';

interface Props {
  message: HouseMessage;
  isMine: boolean;
  senderName: string;
  /** First message of a run from the same person: show who sent it */
  firstInGroup: boolean;
  /** Last message of the run: show the time */
  lastInGroup: boolean;
}

export default function ChatMessage({ message, isMine, senderName, firstInGroup, lastInGroup }: Props) {
  const img = resolveProofUrl(message.imageUrl);
  const time = format(new Date(message.createdAt), 'h:mm a');

  return (
    <div className={cn('flex items-end gap-2', isMine && 'justify-end')}>
      {!isMine && (
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-bold text-neutral-700',
            !lastInGroup && 'invisible',
          )}
        >
          {senderName[0]?.toUpperCase() ?? '?'}
        </span>
      )}

      <div className={cn('flex max-w-[min(75%,560px)] flex-col', isMine ? 'items-end' : 'items-start')}>
        {!isMine && firstInGroup && <p className="mb-1 px-1 text-xs font-semibold text-neutral-500">{senderName}</p>}
        <div
          className={cn(
            'rounded-[18px] px-3.5 py-2 text-[15px] leading-snug',
            isMine ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900',
            // tail corner only on the last bubble of a run
            lastInGroup && (isMine ? 'rounded-br-md' : 'rounded-bl-md'),
          )}
        >
          {img && (
            <a href={img} target="_blank" rel="noopener noreferrer" className="-mx-1.5 -mt-0.5 mb-1.5 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="Shared image" className="max-h-64 rounded-xl object-cover" />
            </a>
          )}
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>
        {lastInGroup && <p className="mt-1 px-1 text-[11px] text-neutral-400">{time}</p>}
      </div>
    </div>
  );
}
