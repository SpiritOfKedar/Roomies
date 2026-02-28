'use client';
import { useState, useEffect, useCallback } from 'react';
import { housesApi, tasksApi } from '@/lib/endpoints';
import type { House, Task, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';
import { format, isPast, formatDistanceToNow } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected:  'bg-red-50 text-red-700 border border-red-200',
  expired:   'bg-neutral-100 text-neutral-500 border border-neutral-200',
  disputed:  'bg-purple-50 text-purple-700 border border-purple-200',
};

const TASK_ICONS = ['mop', 'local_laundry_service', 'restaurant', 'recycling', 'vacuum', 'kitchen'];

type FilterStatus = 'all' | 'pending' | 'submitted' | 'completed' | 'rejected' | 'expired';

export default function TasksPage() {
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [allTasks, setAllTasks] = useState<{ task: Task; house: House }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showSubmit, setShowSubmit] = useState<Task | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const houseRes = await housesApi.list();
      const houseList: House[] = houseRes.data.data ?? [];
      setHouses(houseList);

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
        (a, b) => new Date(b.task.createdAt).getTime() - new Date(a.task.createdAt).getTime()
      );
      setAllTasks(flat);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const filtered = filter === 'all'
    ? allTasks
    : allTasks.filter(t => t.task.status === filter);

  const myTasks = filtered.filter(t => t.task.assignedTo === user?.id);
  const otherTasks = filtered.filter(t => t.task.assignedTo !== user?.id);

  const counts = {
    all: allTasks.length,
    pending: allTasks.filter(t => t.task.status === 'pending').length,
    submitted: allTasks.filter(t => t.task.status === 'submitted').length,
    completed: allTasks.filter(t => t.task.status === 'completed').length,
    rejected: allTasks.filter(t => t.task.status === 'rejected').length,
    expired: allTasks.filter(t => t.task.status === 'expired').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#171717]">My Tasks</h1>
          <p className="text-[#737373] text-sm mt-1">Tasks across all your houses</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Assigned to me</span>
            <span className="material-symbols-outlined text-[#737373]" style={{ fontSize: '18px' }}>person</span>
          </div>
          <span className="text-3xl font-extrabold text-[#171717]">{allTasks.filter(t => t.task.assignedTo === user?.id).length}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Pending</span>
            <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '18px' }}>schedule</span>
          </div>
          <span className="text-3xl font-extrabold text-amber-600">{counts.pending}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Completed</span>
            <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '18px' }}>check_circle</span>
          </div>
          <span className="text-3xl font-extrabold text-emerald-600">{counts.completed}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Overdue</span>
            <span className="material-symbols-outlined text-red-500" style={{ fontSize: '18px' }}>warning</span>
          </div>
          <span className="text-3xl font-extrabold text-red-600">
            {allTasks.filter(t => t.task.status === 'pending' && isPast(new Date(t.task.deadline))).length}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'pending', 'submitted', 'completed', 'rejected', 'expired'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-[#171717] text-white shadow-md'
                : 'bg-white border border-neutral-200 text-[#737373] hover:border-[#171717] hover:text-[#171717]'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-neutral-300 mb-3" style={{ fontSize: '56px' }}>check_circle</span>
          <p className="text-lg font-semibold text-[#171717]">No tasks found</p>
          <p className="text-sm text-[#737373] mt-1">
            {filter === 'all' ? 'Tasks assigned in your houses will appear here' : `No ${filter} tasks`}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* My tasks */}
          {myTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#737373] uppercase tracking-wider mb-4">
                Assigned to you ({myTasks.length})
              </h2>
              <div className="space-y-3">
                {myTasks.map(({ task, house }, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    house={house}
                    icon={TASK_ICONS[idx % TASK_ICONS.length]}
                    isOwn
                    userId={user?.id}
                    onSubmit={() => setShowSubmit(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other tasks */}
          {otherTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#737373] uppercase tracking-wider mb-4">
                Housemates' tasks ({otherTasks.length})
              </h2>
              <div className="space-y-3">
                {otherTasks.map(({ task, house }, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    house={house}
                    icon={TASK_ICONS[(idx + 3) % TASK_ICONS.length]}
                    isOwn={false}
                    userId={user?.id}
                    onSubmit={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit Proof Modal */}
      <Modal open={!!showSubmit} onClose={() => setShowSubmit(null)} title="Submit Proof">
        <form onSubmit={handleSubmitProof} className="flex flex-col gap-4">
          <p className="text-sm text-[#737373]">
            Upload photo evidence for <strong className="text-[#171717]">{showSubmit?.title}</strong>
          </p>
          <div>
            <label className="label">Proof Image (optional)</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={e => setProofFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowSubmit(null)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Proof'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ── Task Row Component ─────────────────────────────────────────────────────── */
function TaskRow({ task, house, icon, isOwn, userId, onSubmit }: {
  task: Task;
  house: House;
  icon: string;
  isOwn: boolean;
  userId?: string;
  onSubmit: () => void;
}) {
  const overdue = task.status === 'pending' && isPast(new Date(task.deadline));
  const canSubmit = isOwn && task.status === 'pending';

  return (
    <div className={`card !p-0 overflow-hidden transition-all hover:shadow-md ${overdue ? 'ring-1 ring-red-200' : ''}`}>
      <div className="flex items-center gap-5 p-5">
        {/* Icon */}
        <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${
          overdue ? 'bg-red-50 text-red-500' : 'bg-neutral-100 text-[#737373]'
        }`}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[#171717] truncate">{task.title}</h3>
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${STATUS_STYLES[task.status] ?? 'bg-neutral-100 text-neutral-500'}`}>
              {task.status}
            </span>
            {overdue && (
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-[#737373]">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>home</span>
              {house.name}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
              {task.assignee?.name ?? (task.assignedTo === userId ? 'You' : 'Member')}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
              {format(new Date(task.deadline), 'MMM d, yyyy')}
              {overdue && <span className="text-red-500 font-semibold ml-1">({formatDistanceToNow(new Date(task.deadline), { addSuffix: true })})</span>}
            </span>
          </div>
        </div>

        {/* Points + Action */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 text-emerald-600">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stars</span>
              <span className="text-sm font-bold">+{task.rewardPoints}</span>
            </div>
            {Number(task.penaltyFine) > 0 && (
              <span className="text-xs text-red-500 font-medium">-${task.penaltyFine}</span>
            )}
          </div>
          {canSubmit && (
            <button
              onClick={onSubmit}
              className="btn-primary !py-2 !px-4 !text-xs"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
