'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useHouseDashboard } from '@/hooks/useHouseDashboard';
import { HookSidebar } from '@/components/ui/rare/hook-sidebar';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import { computeNeedsYou, isOpen } from '@/lib/turn-status';
import type { Chore, House, HouseDashboard, HouseMember } from '@/types';
import TurnChecklist, { type ChecklistTurn } from './tasks/TurnChecklist';
import NewChoreModal from './tasks/NewChoreModal';

export type TaskView = 'needs' | 'progress' | 'finished';
const VIEWS: TaskView[] = ['needs', 'progress', 'finished'];

interface Props {
  house: House;
  members: HouseMember[];
  isAdmin: boolean;
  prefetchedDashboard?: HouseDashboard;
  view: TaskView;
  onViewChange: (view: TaskView) => void;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        {title}
        {count != null && <span className="ml-1.5 text-neutral-400">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

export default function TasksTab({ house, members, isAdmin, prefetchedDashboard, view, onViewChange }: Props) {
  const houseId = house.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useHouseDashboard(houseId, 'active', { initialData: prefetchedDashboard });
  // Finished chores need the full list; only fetched when that view is open.
  const { data: allData, isLoading: allLoading } = useHouseDashboard(houseId, 'all', {
    enabled: view === 'finished',
  });

  const chores = data?.chores.items ?? [];
  const voteStatuses = data?.voteStatuses ?? {};
  const needs = useMemo(
    () => computeNeedsYou(chores, voteStatuses, user?.id, members),
    [chores, voteStatuses, user?.id, members],
  );
  const openChores = chores.filter((c) => c.activeInstance && isOpen(c.activeInstance.status));
  const finishedChores = (allData?.chores.items ?? []).filter(
    (c) => !c.activeInstance || !isOpen(c.activeInstance.status),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['house', houseId, 'dashboard'] });

  const byStatus = (status: string) => openChores.filter((c) => c.activeInstance?.status === status);
  // Every list on this tab is the same checklist.
  const list = (turns: ChecklistTurn[]) => (
    <TurnChecklist
      houseId={houseId}
      turns={turns}
      members={members}
      viewerId={user?.id}
      voteStatuses={voteStatuses}
      onChanged={refresh}
    />
  );
  const asTurns = (cs: Chore[]): ChecklistTurn[] => cs.map((chore) => ({ chore, task: chore.activeInstance }));

  // Phones: a small pill beside the filter, so it doesn't sit between the filter and the list.
  // Desktop: the full-width button under the filter rail.
  const newChoreButton = isAdmin && (
    <button
      type="button"
      onClick={() => setShowNew(true)}
      aria-label="New chore"
      className={
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition-colors active:bg-neutral-50 ' +
        'md:w-full md:rounded-lg md:border-transparent md:bg-neutral-900 md:px-5 md:py-2.5 md:text-white md:hover:bg-neutral-800'
      }
    >
      <Plus className="size-4" />
      <span className="md:hidden">New</span>
      <span className="hidden md:inline">New chore</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <aside className="flex shrink-0 flex-row items-start justify-between gap-4 md:w-48 md:flex-col md:items-stretch md:justify-start md:gap-6">
        <HookSidebar
          label="Chores"
          color="#171717"
          items={[
            needs.count ? `Needs you · ${needs.count}` : 'Needs you',
            `In progress · ${openChores.length}`,
            'Finished',
          ]}
          value={VIEWS.indexOf(view)}
          onChange={(i) => onViewChange(VIEWS[i])}
        />
        {newChoreButton}
      </aside>

      <div className="min-w-0 flex-1">
        {isLoading && !data ? (
          <Loader label="Loading chores" />
        ) : view === 'needs' ? (
          needs.myTurns.length + needs.toReview.length + needs.toFix.length === 0 ? (
            <EmptyState
              title="You're all caught up"
              description="Nothing is waiting on you right now. New turns and reviews will show up here."
            />
          ) : (
            <div className="flex flex-col gap-8">
              {needs.toFix.length > 0 && (
                <Section title="Changes requested on yours" count={needs.toFix.length}>
                  {list(needs.toFix)}
                </Section>
              )}
              {needs.toReview.length > 0 && (
                <Section title="Waiting for your review" count={needs.toReview.length}>
                  {list(needs.toReview)}
                </Section>
              )}
              {needs.myTurns.length > 0 && (
                <Section title="Your turns">
                  {list(needs.myTurns)}
                </Section>
              )}
            </div>
          )
        ) : view === 'progress' ? (
          openChores.length === 0 ? (
            <EmptyState
              title="No chores in progress"
              description={isAdmin ? 'Create a chore and Roomies will pick whose turn it is.' : 'Ask a house admin to set up chores.'}
              action={isAdmin ? <button className="btn-primary" onClick={() => setShowNew(true)}>New chore</button> : undefined}
            />
          ) : (
            <div className="flex flex-col gap-8">
              {byStatus('disputed').length > 0 && (
                <Section title="Changes requested" count={byStatus('disputed').length}>
                  {list(asTurns(byStatus('disputed')))}
                </Section>
              )}
              {byStatus('submitted').length > 0 && (
                <Section title="In review" count={byStatus('submitted').length}>
                  {list(asTurns(byStatus('submitted')))}
                </Section>
              )}
              {byStatus('pending').length > 0 && (
                <Section title="To do" count={byStatus('pending').length}>
                  {list(asTurns(byStatus('pending')))}
                </Section>
              )}
            </div>
          )
        ) : allLoading && !allData ? (
          <Loader label="Loading finished chores" />
        ) : finishedChores.length === 0 ? (
          <EmptyState
            title="Nothing finished yet"
            description="One-off chores land here when they're done. Recurring chores keep every past turn on their own page."
          />
        ) : (
          <Section title="Finished chores" count={finishedChores.length}>
            {list(asTurns(finishedChores))}
          </Section>
        )}
      </div>

      {isAdmin && (
        <NewChoreModal
          open={showNew}
          onClose={() => setShowNew(false)}
          houseId={houseId}
          members={members}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
