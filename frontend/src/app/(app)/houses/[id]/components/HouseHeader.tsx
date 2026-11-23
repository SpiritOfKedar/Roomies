'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Plus, Settings, ShieldCheck } from 'lucide-react';
import BellToggle from '@/components/ui/reactbits/bell-toggle';
import type { House, HouseMember } from '@/types';

type Props = {
  house: House;
  members: HouseMember[];
  isAdmin: boolean;
  viewerId?: string;
  alertsEnabled: boolean;
  onAlertsChange: (on: boolean) => void;
  needsCount: number;
  onManageHouse: () => void;
  onAddMember: () => void;
  onManageRoommate: (userId: string) => void;
};

const MAX_AVATARS = 5;

/**
 * House page header: identity on the left (mark, name, roommates, invite code),
 * actions on the right. Sits on the page background, no card, so it reads as
 * the page title rather than another box.
 */
export default function HouseHeader({
  house,
  members,
  isAdmin,
  viewerId,
  alertsEnabled,
  onAlertsChange,
  needsCount,
  onManageHouse,
  onAddMember,
  onManageRoommate,
}: Props) {
  const shown = members.slice(0, MAX_AVATARS);
  const extra = members.length - shown.length;
  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <header className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#171717] text-xl font-bold text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]">
          {house.name[0]?.toUpperCase() ?? '?'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[#171717] md:text-3xl">{house.name}</h1>
            {isAdmin && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                <ShieldCheck className="size-3" strokeWidth={2.5} />
                Admin
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#737373]">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {shown.map((m) => {
                  const removable = isAdmin && m.userId !== viewerId;
                  const name = m.user?.name ?? 'Roommate';
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      title={removable ? `${name}: manage` : name}
                      aria-label={removable ? `Manage ${name}` : name}
                      disabled={!removable}
                      onClick={() => removable && onManageRoommate(m.userId)}
                      className={clsx(
                        'relative flex size-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-white ring-2 ring-[#FAFAFA] transition-transform',
                        removable ? 'cursor-pointer hover:z-10 hover:-translate-y-0.5' : 'cursor-default',
                      )}
                    >
                      {name[0]?.toUpperCase() ?? '?'}
                      <span
                        className={clsx(
                          'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[#FAFAFA]',
                          m.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400',
                        )}
                      />
                    </button>
                  );
                })}
                {extra > 0 && (
                  <span className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-[#525252] ring-2 ring-[#FAFAFA]">
                    +{extra}
                  </span>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onAddMember}
                  aria-label="Add a roommate"
                  title="Add a roommate"
                  className="ml-1.5 flex size-8 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-[#171717] hover:text-[#171717]"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>

            <span>
              <span className="font-semibold text-[#171717]">{members.length}</span>{' '}
              {members.length === 1 ? 'roommate' : 'roommates'}
              {activeCount < members.length && ` · ${activeCount} active`}
            </span>

            {house.inviteCode && isAdmin && (
              <>
                <span aria-hidden="true" className="hidden h-4 w-px bg-neutral-300 sm:block" />
                <InviteCode code={house.inviteCode} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <BellToggle
          pressed={alertsEnabled}
          onChange={onAlertsChange}
          offLabel="Alerts off"
          onLabel="Alerts on"
          label={
            alertsEnabled
              ? `Alerts on${needsCount ? `, ${needsCount} waiting on you` : ''}. Turn off`
              : 'Alerts off. Turn on'
          }
          badge
          count={needsCount}
          color="#171717"
          background="#ffffff"
          onColor="#ffffff"
          onBackground="#171717"
          size="sm"
        />
        <button
          type="button"
          onClick={onManageHouse}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-4 text-[13px] font-medium text-[#171717] shadow-sm transition-colors hover:border-[#171717]"
        >
          <Settings className="size-4" />
          Manage
        </button>
      </div>
    </header>
  );
}

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the code is still selectable */
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span>Invite</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Invite code copied' : `Copy invite code ${code}`}
        className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white pr-2 pl-3 font-mono text-xs font-medium tracking-wider text-[#171717] transition-colors hover:border-[#171717]"
      >
        {code}
        <span className="flex size-4 items-center justify-center text-neutral-400 group-hover:text-[#171717]">
          {copied ? <Check className="size-3.5 text-emerald-600" strokeWidth={2.5} /> : <Copy className="size-3.5" />}
        </span>
      </button>
    </span>
  );
}
