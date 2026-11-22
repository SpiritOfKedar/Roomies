'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { ArrowLeftRight, Plus } from 'lucide-react';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import SubmitButton from '@/components/ui/SubmitButton';
import StatusChip from '@/components/turns/StatusChip';
import { useActionStatus } from '@/hooks/useActionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useHouseDashboard } from '@/hooks/useHouseDashboard';
import { swapsApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dueSummary } from '@/lib/deadline';
import { firstName, memberName, type Tone } from '@/lib/turn-status';
import type { HouseMember, TaskSwap } from '@/types';

interface Props {
  houseId: string;
  members: HouseMember[];
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Waiting', tone: 'info' },
  accepted: { label: 'Swapped', tone: 'success' },
  rejected: { label: 'Declined', tone: 'neutral' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
};

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        {title} <span className="ml-1 text-neutral-400">{count}</span>
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function SwapCard({
  swap,
  houseId,
  viewerId,
  members,
  onChanged,
}: {
  swap: TaskSwap;
  houseId: string;
  viewerId?: string;
  members: HouseMember[];
  onChanged: () => void;
}) {
  const accept = useActionStatus();
  const decline = useActionStatus();
  const incoming = swap.receiverId === viewerId && swap.status === 'pending';
  const requester = swap.requester?.name ?? memberName(members, swap.requesterId);
  const receiver = swap.receiver?.name ?? memberName(members, swap.receiverId);
  const offered = swap.offeredTask?.title ?? 'a chore';
  const requested = swap.requestedTask?.title ?? 'a chore';
  const status = STATUS[swap.status] ?? STATUS.pending;

  const resolve = async (action: 'accept' | 'reject') => {
    try {
      await (action === 'accept' ? accept : decline).run(() => swapsApi.resolve(houseId, swap.id, action));
      toast.success(action === 'accept' ? `Swapped. "${offered}" is yours now` : 'Swap declined');
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the swap'));
    }
  };

  const who = (id: string, name: string) => (id === viewerId ? 'You' : firstName(name));

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{who(swap.requesterId, requester)}</span>
          {' asked '}
          <span className="font-semibold text-neutral-900">{swap.receiverId === viewerId ? 'you' : firstName(receiver)}</span>
          {' to swap'}
        </p>
        <StatusChip label={status.label} tone={status.tone} />
        <span className="ml-auto text-xs text-neutral-400">
          {formatDistanceToNow(new Date(swap.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">{who(swap.requesterId, requester)} give{swap.requesterId === viewerId ? '' : 's'}</p>
          <p className="truncate text-sm font-semibold text-neutral-900">{offered}</p>
        </div>
        <ArrowLeftRight className="size-4 text-neutral-400" aria-hidden />
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">{who(swap.requesterId, requester)} take{swap.requesterId === viewerId ? '' : 's'}</p>
          <p className="truncate text-sm font-semibold text-neutral-900">{requested}</p>
        </div>
      </div>

      {incoming && (
        <div className="mt-4 flex gap-2">
          <SubmitButton
            type="button"
            status={accept.status}
            className="flex-1"
            disabled={decline.status !== 'idle'}
            onClick={() => resolve('accept')}
            labels={{ running: 'Swapping…', done: 'Swapped', failed: 'Try again' }}
          >
            Accept swap
          </SubmitButton>
          <SubmitButton
            type="button"
            tone="light"
            status={decline.status}
            className="flex-1"
            disabled={accept.status !== 'idle'}
            onClick={() => resolve('reject')}
            labels={{ running: 'Declining…', done: 'Declined', failed: 'Try again' }}
          >
            Decline
          </SubmitButton>
        </div>
      )}
    </li>
  );
}

function ProposeSwapModal({
  open,
  onClose,
  houseId,
  members,
  viewerId,
  onProposed,
}: {
  open: boolean;
  onClose: () => void;
  houseId: string;
  members: HouseMember[];
  viewerId?: string;
  onProposed: () => void;
}) {
  const { data: dashboard } = useHouseDashboard(houseId);
  const [offered, setOffered] = useState('');
  const [requested, setRequested] = useState('');
  const { status, run } = useActionStatus();

  // Only turns nobody has handed in yet can be swapped.
  const pending = useMemo(
    () => (dashboard?.chores.items ?? []).flatMap((c) => (c.activeInstance?.status === 'pending' ? [c.activeInstance] : [])),
    [dashboard],
  );
  const mine = pending.filter((t) => t.assignedTo === viewerId);
  const theirs = pending.filter(
    (t) => t.assignedTo !== viewerId && members.some((m) => m.userId === t.assignedTo && m.status === 'active'),
  );
  const target = theirs.find((t) => t.id === requested);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offered || !target) return;
    try {
      await run(() =>
        swapsApi.propose(houseId, { offeredTaskId: offered, requestedTaskId: target.id, receiverId: target.assignedTo }),
      );
      toast.success(`Swap sent to ${firstName(memberName(members, target.assignedTo))}`);
      setOffered('');
      setRequested('');
      onProposed();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not propose the swap'));
    }
  };

  const nothingToOffer = mine.length === 0;
  const nothingToTake = theirs.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Propose a swap"
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <SubmitButton
            form="propose-swap-form"
            status={status}
            className="flex-1"
            disabled={!offered || !target}
            labels={{ running: 'Sending…', done: 'Sent', failed: 'Try again' }}
          >
            Send request
          </SubmitButton>
        </div>
      }
    >
      <form id="propose-swap-form" onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Can&apos;t make your turn? Offer it for one of a housemate&apos;s. They can accept or decline.
        </p>
        {/* Both fields always render the same way; an empty one is disabled with a short hint. */}
        <div>
          <Select
            label="Your turn to give away"
            value={offered}
            onChange={setOffered}
            disabled={nothingToOffer}
            placeholder={nothingToOffer ? 'No open turns of yours' : 'Choose one of your turns'}
            options={mine.map((t) => ({ value: t.id, label: t.title, tag: dueSummary(t.deadline).replace('due ', '') }))}
          />
          {nothingToOffer && (
            <p className="mt-1.5 text-xs text-neutral-500">Only turns that haven&apos;t been handed in can be swapped.</p>
          )}
        </div>
        <div>
          <Select
            label="Their turn you'll take"
            value={requested}
            onChange={setRequested}
            disabled={nothingToTake}
            placeholder={nothingToTake ? 'No open turns to swap with' : "Choose a housemate's turn"}
            options={theirs.map((t) => ({ value: t.id, label: t.title, tag: firstName(memberName(members, t.assignedTo)) }))}
          />
          {nothingToTake && (
            <p className="mt-1.5 text-xs text-neutral-500">Housemates need an open turn before you can swap.</p>
          )}
        </div>
        {target && offered && (
          <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
            If {firstName(memberName(members, target.assignedTo))} accepts, you&apos;ll do{' '}
            <span className="font-semibold">{target.title}</span> and they&apos;ll do{' '}
            <span className="font-semibold">{mine.find((t) => t.id === offered)?.title}</span>. Both deadlines reset for the new owner.
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Trade a turn with a housemate: requests waiting on you, ones you sent, and history. */
export default function SwapsTab({ houseId, members }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [proposing, setProposing] = useState(false);

  const { data: swaps = [], isLoading } = useQuery({
    queryKey: queryKeys.swaps(houseId),
    queryFn: async () => (await swapsApi.list(houseId)).data.data ?? [],
    enabled: !!houseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.swaps(houseId) });
    queryClient.invalidateQueries({ queryKey: ['house', houseId, 'dashboard'] });
  };

  const incoming = swaps.filter((s) => s.status === 'pending' && s.receiverId === user?.id);
  const outgoing = swaps.filter((s) => s.status === 'pending' && s.requesterId === user?.id);
  const others = swaps.filter((s) => s.status === 'pending' && s.requesterId !== user?.id && s.receiverId !== user?.id);
  const history = swaps.filter((s) => s.status !== 'pending');

  const card = (s: TaskSwap) => (
    <SwapCard key={s.id} swap={s} houseId={houseId} viewerId={user?.id} members={members} onChanged={refresh} />
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Swaps</h2>
          <p className="text-sm text-neutral-500">Trade a turn with a housemate when you can&apos;t make yours.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setProposing(true)}>
          <Plus className="size-4" />
          Propose a swap
        </button>
      </div>

      {isLoading ? (
        <Loader label="Loading swaps" />
      ) : swaps.length === 0 ? (
        <EmptyState
          title="No swaps yet"
          description="If you can't make your turn, offer it for one of a housemate's."
          action={<button className="btn-primary" onClick={() => setProposing(true)}>Propose a swap</button>}
        />
      ) : (
        <>
          {incoming.length > 0 && <Section title="Waiting on you" count={incoming.length}>{incoming.map(card)}</Section>}
          {outgoing.length > 0 && <Section title="Sent by you" count={outgoing.length}>{outgoing.map(card)}</Section>}
          {others.length > 0 && <Section title="Between housemates" count={others.length}>{others.map(card)}</Section>}
          {history.length > 0 && <Section title="History" count={history.length}>{history.map(card)}</Section>}
        </>
      )}

      <ProposeSwapModal
        open={proposing}
        onClose={() => setProposing(false)}
        houseId={houseId}
        members={members}
        viewerId={user?.id}
        onProposed={refresh}
      />
    </div>
  );
}
