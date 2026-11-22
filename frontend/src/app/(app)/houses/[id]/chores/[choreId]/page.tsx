'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarClock, Pencil, Repeat } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useHouseDashboard } from '@/hooks/useHouseDashboard';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { describeTurn, isOpen, scheduleLabel } from '@/lib/turn-status';
import { formatDue, relativeDue } from '@/lib/deadline';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/turns/StatusChip';
import { AnimatedCounter } from '@/components/ui/rare/animated-counter';
import { DeleteButton } from '@/components/ui/rare/delete-button';
import NextStep from './NextStep';
import TurnTimeline from './TurnTimeline';
import PreviousTurns from './PreviousTurns';
import EditTurnModal from './EditTurnModal';

export default function ChorePage() {
  const { id: houseId, choreId } = useParams<{ id: string; choreId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: dashboard } = useHouseDashboard(houseId);
  const members = dashboard?.house.members ?? [];
  const isAdmin = members.some((m) => m.userId === user?.id && m.role === 'admin' && m.status === 'active');

  const threadQ = useQuery({
    queryKey: queryKeys.choreThread(choreId),
    queryFn: async () => (await tasksApi.getChoreThread(choreId)).data.data,
    enabled: !!choreId,
  });
  const thread = threadQ.data;
  const task = thread?.activeInstance ?? null;

  // Vote tallies are always read fresh for the turn on screen.
  const voteQ = useQuery({
    queryKey: queryKeys.taskVotes(task?.id ?? ''),
    queryFn: async () => (await tasksApi.getVotes(task!.id)).data.data,
    enabled: !!task && task.status === 'submitted',
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.choreThread(choreId) });
    queryClient.invalidateQueries({ queryKey: ['task'] });
    queryClient.invalidateQueries({ queryKey: ['house', houseId] });
  };

  if (threadQ.isLoading) return <Loader label="Loading chore" showLabel />;
  if (threadQ.isError || !thread) {
    return (
      <EmptyState
        title="Chore not found"
        description="It may have been deleted, or you're not a member of this house."
        action={<Link href={`/houses/${houseId}`} className="btn-primary">Back to house</Link>}
      />
    );
  }

  const currentCycle = task ? thread.cycles.find((c) => c.instanceId === task.id) : undefined;
  const previous = thread.cycles.filter((c) => c.instanceId !== task?.id).reverse();
  const view = task ? describeTurn(task, user?.id, members, voteQ.data) : null;
  const maxResubmissions = thread.maxResubmissions;
  const turnIsOpen = !!task && isOpen(task.status);

  const doneBy = thread.cycles
    .filter((c) => c.status === 'completed')
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.assigneeName]: (acc[c.assigneeName] ?? 0) + 1 }), {});

  const deleteTurn = async () => {
    if (!task) return;
    try {
      await tasksApi.delete(houseId, task.id);
      toast.success('Turn deleted');
      queryClient.invalidateQueries({ queryKey: ['house', houseId] });
      // Let the delete button's confirmation tick play before leaving.
      setTimeout(() => router.push(`/houses/${houseId}`), 700);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete'));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href={`/houses/${houseId}`} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="size-4" />
        {dashboard?.house.name ?? 'Back to house'}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{thread.title}</h1>
          {view && <StatusChip label={view.label} tone={view.tone} />}
        </div>
        {view && <p className="text-lg text-neutral-600">{view.sentence}</p>}
        {task && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" />
              {formatDue(task.deadline)} ({relativeDue(task.deadline)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Repeat className="size-4" />
              {scheduleLabel(thread.isRecurring, task.cronSchedule)}
            </span>
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          {task && (
            <NextStep
              houseId={houseId}
              choreTitle={thread.title}
              task={task}
              cycle={currentCycle}
              vote={voteQ.data}
              members={members}
              viewerId={user?.id}
              maxResubmissions={maxResubmissions}
              onChanged={refresh}
            />
          )}

          {currentCycle && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wider text-neutral-500">This turn</h2>
              <TurnTimeline
                cycle={currentCycle}
                assignedAt={task?.createdAt}
                maxAttempts={maxResubmissions + 1}
                onChanged={refresh}
              />
            </section>
          )}

          {previous.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Previous turns <span className="text-neutral-400">{previous.length}</span>
              </h2>
              <PreviousTurns cycles={previous} />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">On the line</p>
            <div className="mt-3 flex items-baseline gap-2">
              <AnimatedCounter value={task?.rewardPoints ?? thread.rewardPoints} prefix="+" className="text-3xl font-extrabold text-emerald-600" />
              <span className="text-sm text-neutral-500">points when approved</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <AnimatedCounter
                value={Number(task?.penaltyFine ?? thread.penaltyFine)}
                prefix="₹"
                grouping="indian"
                decimals={Number(task?.penaltyFine ?? thread.penaltyFine) % 1 ? 2 : 0}
                className="text-xl font-bold text-red-600"
              />
              <span className="text-sm text-neutral-500">fine if missed</span>
            </div>
          </div>

          {Object.keys(doneBy).length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Who&apos;s done it</p>
              <ul className="mt-3 flex flex-col gap-2">
                {Object.entries(doneBy)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <li key={name} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-800">{name}</span>
                      <span className="font-semibold text-neutral-900">{count}×</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {isAdmin && turnIsOpen && task && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Admin</p>
              <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Edit turn
              </button>
              {/* Delete expands sideways into confirm / cancel, so it gets its own row */}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                <p className="text-xs text-neutral-500">Delete this turn, its proof and votes</p>
                <DeleteButton onConfirm={deleteTurn} className="shrink-0" />
              </div>
            </div>
          )}
        </aside>
      </div>

      {isAdmin && task && (
        <EditTurnModal open={editing} onClose={() => setEditing(false)} houseId={houseId} task={task} members={members} onSaved={refresh} />
      )}
    </div>
  );
}
