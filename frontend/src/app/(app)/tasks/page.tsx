'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { housesApi, tasksApi } from '@/lib/endpoints';
import type { House, Task } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';
import { format, isPast, formatDistanceToNow } from 'date-fns';

type FilterStatus = 'all' | 'pending' | 'submitted' | 'completed' | 'rejected' | 'expired' | 'disputed';

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  submitted: 'bg-blue-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
  expired: 'bg-neutral-400',
  disputed: 'bg-amber-600',
};

export default function TasksPage() {
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<{ task: Task; house: House }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showSubmit, setShowSubmit] = useState<Task | null>(null);
  const [showResubmit, setShowResubmit] = useState<Task | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const houseRes = await housesApi.list();
      const houseList: House[] = houseRes.data.data ?? [];

      const taskPromises = houseList.map(async (h) => {
        try {
          const res = await tasksApi.list(h.id, 1, 100);
          return (res.data.data?.items ?? []).map((t: Task) => ({ task: t, house: h }));
        } catch {
          return [];
        }
      });
      const results = await Promise.all(taskPromises);
      const flat = results.flat().sort(
        (a, b) => new Date(a.task.deadline).getTime() - new Date(b.task.deadline).getTime(),
      );
      setAllTasks(flat);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const myTasksAll = useMemo(
    () => allTasks.filter((t) => t.task.assignedTo === user?.id),
    [allTasks, user?.id],
  );

  const filtered = useMemo(() => {
    const base = filter === 'all' ? allTasks : allTasks.filter((t) => t.task.status === filter);
    return base;
  }, [allTasks, filter]);

  const myTasks = filtered.filter((t) => t.task.assignedTo === user?.id);
  const otherTasks = filtered.filter((t) => t.task.assignedTo !== user?.id);

  const myCounts = useMemo(() => ({
    all: myTasksAll.length,
    pending: myTasksAll.filter((t) => t.task.status === 'pending').length,
    submitted: myTasksAll.filter((t) => t.task.status === 'submitted').length,
    completed: myTasksAll.filter((t) => t.task.status === 'completed').length,
    overdue: myTasksAll.filter(
      (t) => t.task.status === 'pending' && isPast(new Date(t.task.deadline)),
    ).length,
    disputed: myTasksAll.filter((t) => t.task.status === 'disputed').length,
  }), [myTasksAll]);

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmit) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (proofFile) fd.append('proof', proofFile);
      await tasksApi.submit(showSubmit.houseId, showSubmit.id, fd);
      toast.success('Proof submitted!');
      setShowSubmit(null);
      setProofFile(null);
      load();
    } catch {
      toast.error('Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResubmit) return;
    const clarification = (e.target as HTMLFormElement).clarification?.value;
    if (!clarification?.trim()) {
      toast.error('Clarification is required');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (proofFile) fd.append('proof', proofFile);
      fd.append('note', clarification.trim());
      await tasksApi.submit(showResubmit.houseId, showResubmit.id, fd);
      toast.success('Proof resubmitted!');
      setShowResubmit(null);
      setProofFile(null);
      load();
    } catch {
      toast.error('Failed to resubmit proof');
    } finally {
      setSubmitting(false);
    }
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'disputed', label: 'Disputed' },
    { key: 'completed', label: 'Done' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Tasks</h1>
        <p className="text-sm text-neutral-500">Your chores across all houses, sorted by deadline.</p>
      </header>

      {/* Personal stats — scoped to current user only */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assigned" value={myCounts.all} />
        <StatCard label="Pending" value={myCounts.pending} accent="text-amber-600" />
        <StatCard label="Done" value={myCounts.completed} accent="text-emerald-600" />
        <StatCard label="Overdue" value={myCounts.overdue} accent="text-red-600" />
      </div>

      {myCounts.disputed > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {myCounts.disputed} disputed task{myCounts.disputed !== 1 ? 's' : ''} need your attention.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 pb-px">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              filter === key
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-10">
          {myTasks.length > 0 && (
            <TaskSection title="Your tasks" tasks={myTasks} isOwn onSubmit={setShowSubmit} onResubmit={setShowResubmit} />
          )}
          {otherTasks.length > 0 && (
            <TaskSection title="Housemates" tasks={otherTasks} isOwn={false} onSubmit={() => {}} onResubmit={() => {}} />
          )}
        </div>
      )}

      <Modal open={!!showSubmit} onClose={() => setShowSubmit(null)} title="Submit Proof">
        <form onSubmit={handleSubmitProof} className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Upload photo evidence for <strong>{showSubmit?.title}</strong>
          </p>
          <div>
            <label className="label">Proof image</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowSubmit(null)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showResubmit} onClose={() => setShowResubmit(null)} title="Resubmit Proof">
        <form onSubmit={handleResubmitProof} className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Add clarification and optionally a new image.
          </div>
          <div>
            <label className="label">Updated proof image</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="label">Clarification *</label>
            <textarea name="clarification" className="input resize-none" rows={3} required placeholder="Explain your resubmission…" />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowResubmit(null)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Resubmit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${accent ?? 'text-neutral-900'}`}>{value}</p>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterStatus }) {
  return (
    <div className="py-16 text-center">
      <p className="font-medium text-neutral-800">No tasks found</p>
      <p className="mt-1 text-sm text-neutral-500">
        {filter === 'all' ? 'Tasks assigned in your houses will appear here.' : `No ${filter} tasks right now.`}
      </p>
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  isOwn,
  onSubmit,
  onResubmit,
}: {
  title: string;
  tasks: { task: Task; house: House }[];
  isOwn: boolean;
  onSubmit: (t: Task) => void;
  onResubmit: (t: Task) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {tasks.map(({ task, house }) => (
          <TaskRow
            key={task.id}
            task={task}
            house={house}
            isOwn={isOwn}
            onSubmit={() => onSubmit(task)}
            onResubmit={() => onResubmit(task)}
          />
        ))}
      </ul>
    </section>
  );
}

function TaskRow({
  task,
  house,
  isOwn,
  onSubmit,
  onResubmit,
}: {
  task: Task;
  house: House;
  isOwn: boolean;
  onSubmit: () => void;
  onResubmit: () => void;
}) {
  const overdue = task.status === 'pending' && isPast(new Date(task.deadline));
  const needsAction = isOwn && (task.status === 'pending' || task.status === 'disputed');
  const dot = STATUS_DOT[task.status] ?? 'bg-neutral-300';

  return (
    <li className={`flex items-center gap-4 px-4 py-3.5 ${needsAction ? 'bg-amber-50/40' : ''}`}>
      <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate font-medium text-neutral-900">{task.title}</p>
          {overdue && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-red-600">Overdue</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {house.name}
          {' · '}
          {format(new Date(task.deadline), 'MMM d')}
          {overdue && ` · ${formatDistanceToNow(new Date(task.deadline), { addSuffix: true })}`}
          {!isOwn && task.assignee?.name && ` · ${task.assignee.name}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold text-emerald-600">+{task.rewardPoints}</span>
        {isOwn && task.status === 'pending' && (
          <button onClick={onSubmit} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700">
            Submit
          </button>
        )}
        {isOwn && task.status === 'disputed' && (
          <button onClick={onResubmit} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
            Resubmit
          </button>
        )}
        <Link href={`/houses/${house.id}?tab=tasks`} className="text-xs font-medium text-neutral-400 hover:text-neutral-700">
          Open
        </Link>
      </div>
    </li>
  );
}
