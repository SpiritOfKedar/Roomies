'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, LogIn, Plus } from 'lucide-react';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import SubmitButton from '@/components/ui/SubmitButton';
import { AnimatedCounter } from '@/components/ui/rare/animated-counter';
import { useActionStatus } from '@/hooks/useActionStatus';
import { useAuth } from '@/hooks/useAuth';
import { housesApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { computeNeedsYou, firstName, isOpen, memberName } from '@/lib/turn-status';
import { dueSummary } from '@/lib/deadline';
import type { House, HouseDashboard } from '@/types';

function HouseCard({ house, dashboard, viewerId }: { house: House; dashboard?: HouseDashboard; viewerId?: string }) {
  const members = dashboard?.house.members ?? house.members ?? [];
  const active = members.filter((m) => m.status === 'active');
  const chores = dashboard?.chores.items ?? [];
  const open = chores.flatMap((c) => (c.activeInstance && isOpen(c.activeInstance.status) ? [c.activeInstance] : []));
  const needs = computeNeedsYou(chores, dashboard?.voteStatuses ?? {}, viewerId, members).count;
  const next = open
    .filter((t) => t.status === 'pending')
    .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0];

  return (
    <Link
      href={`/houses/${house.id}`}
      className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-neutral-900">{house.name}</h3>
          <p className="text-sm text-neutral-500">
            {active.length} {active.length === 1 ? 'roommate' : 'roommates'}
          </p>
        </div>
        <div className="flex -space-x-2">
          {active.slice(0, 4).map((m) => (
            <span
              key={m.userId}
              title={m.user?.name}
              className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white ring-2 ring-white"
            >
              {m.user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          ))}
          {active.length > 4 && (
            <span className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-2 ring-white">
              +{active.length - 4}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Waiting on you</p>
          <AnimatedCounter value={needs} className={`text-xl font-bold ${needs ? 'text-neutral-900' : 'text-neutral-400'}`} />
        </div>
        <div className="rounded-xl bg-neutral-50 px-3 py-2">
          <p className="text-xs text-neutral-500">Open chores</p>
          <AnimatedCounter value={open.length} className="text-xl font-bold text-neutral-900" />
        </div>
      </div>

      <p className="mt-4 min-h-[20px] truncate text-sm text-neutral-600">
        {!dashboard
          ? 'Loading…'
          : next
            ? <>Next up: <span className="font-semibold text-neutral-900">{next.title}</span> · {next.assignedTo === viewerId ? 'you' : firstName(memberName(members, next.assignedTo))} · {dueSummary(next.deadline)}</>
            : 'No turns waiting to be done.'}
      </p>

      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-900">
        Open house <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const housesQ = useQuery({
    queryKey: ['houses'],
    queryFn: async () => (await housesApi.list()).data.data ?? [],
  });
  const houses = housesQ.data ?? [];
  // Same cache entries the house pages use.
  const dashboards = useQueries({
    queries: houses.map((h) => ({
      queryKey: queryKeys.houseDashboard(h.id, 'active'),
      queryFn: async () => (await housesApi.dashboard(h.id, 'active')).data.data,
    })),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const createAction = useActionStatus();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const joinAction = useActionStatus();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await createAction.run(() => housesApi.create({ name: createName.trim() }));
      toast.success('House created');
      setShowCreate(false);
      setCreateName('');
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      router.push(`/houses/${data.data.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create the house'));
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await joinAction.run(() => housesApi.join(joinCode.trim()));
      toast.success(`Joined ${data.data.name}`);
      setShowJoin(false);
      setJoinCode('');
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      router.push(`/houses/${data.data.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'That invite code did not work'));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Your houses</h1>
          <p className="mt-1 text-neutral-500">Pick a house to see its chores, expenses and chat.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowJoin(true)}>
            <LogIn className="size-4" />
            Join with a code
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            New house
          </button>
        </div>
      </div>

      {housesQ.isLoading ? (
        <Loader label="Loading your houses" showLabel />
      ) : houses.length === 0 ? (
        <EmptyState
          title="No houses yet"
          description="Create a house for your flat, or join one with the invite code a roommate shared."
          action={
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setShowJoin(true)}>Join with a code</button>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>New house</button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {houses.map((house, i) => (
            <HouseCard key={house.id} house={house} dashboard={dashboards[i]?.data} viewerId={user?.id} />
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New house"
        footer={
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
            <SubmitButton
              form="create-house-form"
              status={createAction.status}
              className="flex-1"
              disabled={createName.trim().length < 2}
              labels={{ running: 'Creating…', done: 'Created', failed: 'Try again' }}
            >
              Create house
            </SubmitButton>
          </div>
        }
      >
        <form id="create-house-form" onSubmit={handleCreate} className="flex flex-col gap-2">
          <label className="label" htmlFor="house-name">House name</label>
          <input
            id="house-name"
            className="input"
            placeholder="e.g. Maple Street Flat"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
          />
          <p className="text-sm text-neutral-500">You&apos;ll be the admin. Invite roommates with the code on the house page.</p>
        </form>
      </Modal>

      <Modal
        open={showJoin}
        onClose={() => setShowJoin(false)}
        title="Join a house"
        footer={
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowJoin(false)}>Cancel</button>
            <SubmitButton
              form="join-house-form"
              status={joinAction.status}
              className="flex-1"
              disabled={joinCode.trim().length < 4}
              labels={{ running: 'Joining…', done: 'Joined', failed: 'Try again' }}
            >
              Join house
            </SubmitButton>
          </div>
        }
      >
        <form id="join-house-form" onSubmit={handleJoin} className="flex flex-col gap-2">
          <label className="label" htmlFor="invite-code">Invite code</label>
          <input
            id="invite-code"
            className="input font-mono uppercase tracking-widest"
            placeholder="6AA399FF"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          <p className="text-sm text-neutral-500">Ask a roommate for it. It&apos;s on their house page.</p>
        </form>
      </Modal>
    </div>
  );
}
