'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import SubmitButton from '@/components/ui/SubmitButton';
import GlideSelect from '@/components/ui/reactbits/glide-select';
import StatusChip from '@/components/turns/StatusChip';
import { AnimatedCounter } from '@/components/ui/rare/animated-counter';
import { useActionStatus } from '@/hooks/useActionStatus';
import { useAuth } from '@/hooks/useAuth';
import { penaltiesApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { formatINR } from '@/lib/currency';
import { memberName } from '@/lib/turn-status';
import type { HouseMember, Penalty } from '@/types';

interface Props {
  houseId: string;
  members: HouseMember[];
  isAdmin: boolean;
}

type Filter = 'unpaid' | 'settled' | 'all';

function Stat({ label, value, prefix, tone }: { label: string; value: number; prefix?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <AnimatedCounter
        value={value}
        prefix={prefix}
        grouping="indian"
        decimals={Number.isInteger(value) ? 0 : 2}
        className={`mt-0.5 text-2xl font-bold ${tone}`}
      />
    </div>
  );
}

function PenaltyRow({
  penalty,
  houseId,
  members,
  viewerId,
  isAdmin,
  onChanged,
}: {
  penalty: Penalty;
  houseId: string;
  members: HouseMember[];
  viewerId?: string;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const { status, run } = useActionStatus();
  const name = penalty.user?.name ?? memberName(members, penalty.userId);
  const isMe = penalty.userId === viewerId;
  const unpaid = penalty.status === 'unpaid';

  const settle = async () => {
    try {
      await run(() => penaltiesApi.settle(houseId, penalty.id));
      toast.success(`Marked ${isMe ? 'your' : `${name.split(' ')[0]}'s`} fine as paid`);
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not mark as paid'));
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
        {name[0]?.toUpperCase() ?? '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {isMe ? 'You' : name}
          <span className="font-normal text-neutral-500"> · {penalty.task?.title ? `“${penalty.task.title}”` : 'a chore'}</span>
        </p>
        <p className="text-xs text-neutral-500">
          {format(new Date(penalty.createdAt), 'd MMM yyyy')} · missed or failed review · −{penalty.points} pts
        </p>
      </div>
      <span className={`text-base font-bold ${unpaid ? 'text-red-600' : 'text-neutral-400 line-through'}`}>
        {formatINR(penalty.fineAmount)}
      </span>
      <StatusChip label={unpaid ? 'Unpaid' : 'Paid'} tone={unpaid ? 'danger' : 'success'} />
      {isAdmin && unpaid && (
        <SubmitButton
          type="button"
          tone="light"
          status={status}
          onClick={settle}
          className="!px-3 !py-1.5 text-xs"
          labels={{ running: 'Saving…', done: 'Paid', failed: 'Try again' }}
        >
          Mark paid
        </SubmitButton>
      )}
    </li>
  );
}

/** Fines from missed or failed turns: who owes what, and admins marking them paid. */
export default function PenaltiesSection({ houseId, members, isAdmin }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('unpaid');

  const { data: penalties = [], isLoading } = useQuery({
    queryKey: queryKeys.penalties(houseId),
    queryFn: async () => (await penaltiesApi.list(houseId)).data.data ?? [],
    enabled: !!houseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.penalties(houseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(houseId) });
  };

  const unpaid = penalties.filter((p) => p.status === 'unpaid');
  const houseOwes = unpaid.reduce((sum, p) => sum + Number(p.fineAmount), 0);
  const youOwe = unpaid.filter((p) => p.userId === user?.id).reduce((sum, p) => sum + Number(p.fineAmount), 0);
  const pointsLost = unpaid.reduce((sum, p) => sum + p.points, 0);
  const shown = filter === 'all' ? penalties : penalties.filter((p) => (filter === 'unpaid' ? p.status === 'unpaid' : p.status !== 'unpaid'));

  if (isLoading) return <Loader label="Loading penalties" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-neutral-900">Penalties</h2>
        <p className="text-sm text-neutral-500">
          A missed turn, or one that fails review after every retry, adds a fine.
          {isAdmin ? ' Mark fines paid once the money has changed hands.' : ' An admin marks them paid.'}
        </p>
      </div>

      {penalties.length === 0 ? (
        <EmptyState title="No penalties" description="Nobody has missed a turn. Keep it that way." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="You owe" value={youOwe} prefix="₹" tone={youOwe > 0 ? 'text-red-600' : 'text-neutral-900'} />
            <Stat label="Unpaid in the house" value={houseOwes} prefix="₹" tone="text-neutral-900" />
            <Stat label="Points lost (unpaid)" value={pointsLost} tone="text-neutral-900" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              {filter === 'all' ? 'All fines' : filter === 'unpaid' ? 'Unpaid' : 'Paid'}{' '}
              <span className="ml-1 text-neutral-400">{shown.length}</span>
            </h3>
            <GlideSelect
              ariaLabel="Show fines"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'unpaid', label: 'Unpaid', tag: String(unpaid.length) },
                { value: 'settled', label: 'Paid', tag: String(penalties.length - unpaid.length) },
                { value: 'all', label: 'All', tag: String(penalties.length) },
              ]}
              align="right"
              size="md"
              menuWidth={160}
              surfaceColor="#f5f5f5"
              highlightColor="#e5e5e5"
              textColor="#171717"
              accentColor="#171717"
            />
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              {filter === 'unpaid' ? 'Every fine has been paid.' : 'Nothing here yet.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((p) => (
                <PenaltyRow
                  key={p.id}
                  penalty={p}
                  houseId={houseId}
                  members={members}
                  viewerId={user?.id}
                  isAdmin={isAdmin}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
