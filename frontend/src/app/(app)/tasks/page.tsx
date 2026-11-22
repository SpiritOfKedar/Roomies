'use client';

import Link from 'next/link';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { housesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { computeNeedsYou } from '@/lib/turn-status';
import { AnimatedCounter } from '@/components/ui/rare/animated-counter';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import TurnRow from '../houses/[id]/components/tasks/TurnRow';
import MyTurnsList from '../houses/[id]/components/tasks/MyTurnsList';

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <AnimatedCounter value={value} className={`mt-0.5 text-2xl font-bold ${tone}`} />
    </div>
  );
}

/** Everything waiting on you, across every house you belong to. */
export default function MyTasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const housesQ = useQuery({
    queryKey: ['houses'],
    queryFn: async () => (await housesApi.list()).data.data ?? [],
  });
  const houses = housesQ.data ?? [];

  // Same cache entries as each house page, so switching between them is instant.
  const dashboards = useQueries({
    queries: houses.map((h) => ({
      queryKey: queryKeys.houseDashboard(h.id, 'active'),
      queryFn: async () => (await housesApi.dashboard(h.id, 'active')).data.data,
    })),
  });

  const perHouse = houses.map((house, i) => {
    const dash = dashboards[i]?.data;
    const members = dash?.house.members ?? house.members ?? [];
    const needs = computeNeedsYou(dash?.chores.items ?? [], dash?.voteStatuses ?? {}, user?.id, members);
    return { house, members, voteStatuses: dash?.voteStatuses ?? {}, needs };
  });

  const totals = perHouse.reduce(
    (acc, { needs }) => ({
      todo: acc.todo + needs.myTurns.filter((t) => t.task.status === 'pending').length,
      review: acc.review + needs.toReview.length,
      fix: acc.fix + needs.toFix.length,
      inReview: acc.inReview + needs.myTurns.filter((t) => t.task.status === 'submitted').length,
    }),
    { todo: 0, review: 0, fix: 0, inReview: 0 },
  );

  const loading = housesQ.isLoading || dashboards.some((d) => d.isLoading && !d.data);
  const active = perHouse.filter(({ needs }) => needs.myTurns.length + needs.toReview.length + needs.toFix.length > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Tasks</h1>
        <p className="text-sm text-neutral-500">What&apos;s waiting on you, in every house.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Your turns" value={totals.todo} tone="text-neutral-900" />
        <Stat label="To review" value={totals.review} tone="text-blue-600" />
        <Stat label="To fix" value={totals.fix} tone="text-amber-600" />
        <Stat label="Sent for review" value={totals.inReview} tone="text-emerald-600" />
      </div>

      {loading ? (
        <Loader label="Loading your tasks" showLabel />
      ) : houses.length === 0 ? (
        <EmptyState
          title="You're not in a house yet"
          description="Create or join a house to start sharing chores."
          action={<Link href="/dashboard" className="btn-primary">Go to houses</Link>}
        />
      ) : active.length === 0 ? (
        <EmptyState title="You're all caught up" description="Nothing is waiting on you in any house." />
      ) : (
        active.map(({ house, members, voteStatuses, needs }) => (
          <section key={house.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">{house.name}</h2>
              <Link href={`/houses/${house.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
                Open house <ArrowRight className="size-4" />
              </Link>
            </div>
            {[...needs.toFix, ...needs.toReview].length > 0 && (
              <ul className="flex flex-col gap-2">
                {[...needs.toFix, ...needs.toReview].map(({ chore, task }) => (
                  <TurnRow
                    key={chore.id}
                    houseId={house.id}
                    chore={chore}
                    task={task}
                    members={members}
                    viewerId={user?.id}
                    vote={voteStatuses[task.id]}
                  />
                ))}
              </ul>
            )}
            {needs.myTurns.length > 0 && (
              <MyTurnsList
                houseId={house.id}
                turns={needs.myTurns}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ['house', house.id, 'dashboard'] })}
              />
            )}
          </section>
        ))
      )}
    </div>
  );
}
