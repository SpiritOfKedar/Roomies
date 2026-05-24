'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { tasksApi } from '@/lib/endpoints';
import type { Task, HouseMember, House } from '@/types';
import Modal from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import VoteModal from './tasks/VoteModal';
import ResubmitModal from './tasks/ResubmitModal';
import TaskDetailsModal from './tasks/TaskDetailsModal';
import type { TaskVoteStatus } from '@/types';

interface Props {
  house: House;
  members: HouseMember[];
  isAdmin: boolean;
}

const TASK_ICON_STYLES = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20', icon: 'water_drop' },
  { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20', icon: 'delete' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20', icon: 'wifi' },
  { bg: 'bg-green-500/10', text: 'text-green-400', ring: 'ring-green-500/20', icon: 'cleaning_services' },
  { bg: 'bg-pink-500/10', text: 'text-pink-400', ring: 'ring-pink-500/20', icon: 'shopping_cart' },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-neutral-50 text-neutral-600 ring-neutral-500/10';
    case 'submitted':
      return 'bg-blue-50 text-blue-700 ring-blue-700/10';
    case 'completed':
      return 'bg-green-50 text-green-700 ring-green-600/20';
    case 'disputed':
      return 'bg-amber-50 text-amber-800 ring-amber-500/30';
    case 'expired':
    case 'rejected':
      return 'bg-red-50 text-red-700 ring-red-600/10';
    default:
      return 'bg-neutral-50 text-neutral-600 ring-neutral-500/10';
  }
}

export default function TasksTab({ house, members, isAdmin }: Props) {
  const houseId = house.id;
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voteStatuses, setVoteStatuses] = useState<Record<string, TaskVoteStatus>>({});

  const [showAssign, setShowAssign] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assignWeight, setAssignWeight] = useState(1);
  const [assignIsRecurring, setAssignIsRecurring] = useState(false);
  const [assignCronSchedule, setAssignCronSchedule] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [voteTask, setVoteTask] = useState<Task | null>(null);
  const [resubmitTask, setResubmitTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editReward, setEditReward] = useState(10);
  const [editPenalty, setEditPenalty] = useState('50');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const limit = 10;
  const fetchLimit = 100;

  const isAdminEditable = (status: string) =>
    isAdmin && ['pending', 'submitted', 'disputed'].includes(status);

  const disputedForUser = useMemo(
    () => tasks.filter((t) => t.assignedTo === user?.id && t.status === 'disputed'),
    [tasks, user?.id],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tasksApi.list(houseId, 1, fetchLimit);
      const items = res.data.data?.items ?? [];
      setTasks(items);
      setTotal(items.length);

      const submitted = items.filter((t) => t.status === 'submitted');
      const statuses: Record<string, TaskVoteStatus> = {};
      let needsListRefresh = false;
      await Promise.all(
        submitted.map(async (t) => {
          try {
            const vs = await tasksApi.getVotes(t.id);
            statuses[t.id] = vs.data.data;
            if (vs.data.data.status !== t.status) {
              needsListRefresh = true;
            }
          } catch {
            /* ignore */
          }
        }),
      );
      setVoteStatuses(statuses);

      if (needsListRefresh) {
        const refresh = await tasksApi.list(houseId, 1, fetchLimit);
        const refreshed = refresh.data.data?.items ?? [];
        setTasks(refreshed);
        setTotal(refreshed.length);
        const stillSubmitted = refreshed.filter((t) => t.status === 'submitted');
        const refreshedStatuses: Record<string, TaskVoteStatus> = {};
        await Promise.all(
          stillSubmitted.map(async (t) => {
            try {
              const vs = await tasksApi.getVotes(t.id);
              refreshedStatuses[t.id] = vs.data.data;
            } catch {
              /* ignore */
            }
          }),
        );
        setVoteStatuses(refreshedStatuses);
      }
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [houseId]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const assigneeName =
        members.find((m) => m.userId === t.assignedTo)?.user?.name ?? t.assignee?.name ?? '';
      return (
        t.title.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        assigneeName.toLowerCase().includes(q)
      );
    });
  }, [tasks, searchQuery, members]);

  const pages = Math.max(1, Math.ceil(filteredTasks.length / limit));
  const pagedTasks = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredTasks.slice(start, start + limit);
  }, [filteredTasks, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (viewTask) {
      const updated = tasks.find((t) => t.id === viewTask.id);
      if (updated) setViewTask(updated);
    }
  }, [tasks, viewTask?.id]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await tasksApi.assign(houseId, {
        title: assignTitle,
        description: assignDesc,
        deadline: assignDue ? new Date(assignDue + 'T23:59:59.000Z').toISOString() : '',
        ...(assignUser ? { assignedTo: assignUser } : {}),
        weight: assignWeight,
        isRecurring: assignIsRecurring,
        ...(assignIsRecurring && assignCronSchedule ? { cronSchedule: assignCronSchedule } : {}),
      });
      toast.success('Task assigned!');
      setShowAssign(false);
      setAssignTitle('');
      setAssignDesc('');
      setAssignDue('');
      setAssignUser('');
      setAssignWeight(1);
      setAssignIsRecurring(false);
      setAssignCronSchedule('');
      load();
    } catch {
      toast.error('Failed to assign task');
    } finally {
      setAssigning(false);
    }
  };

  const openEditModal = (task: Task) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditAssignee(task.assignedTo);
    setEditDue(task.deadline ? task.deadline.slice(0, 10) : '');
    setEditReward(task.rewardPoints ?? 10);
    setEditPenalty(String(task.penaltyFine ?? 50));
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setEditing(true);
    try {
      await tasksApi.update(houseId, editTask.id, {
        ...(editTitle !== editTask.title ? { title: editTitle } : {}),
        ...(editAssignee !== editTask.assignedTo ? { assignedTo: editAssignee } : {}),
        ...(editDue
          ? { deadline: new Date(editDue + 'T23:59:59.000Z').toISOString() }
          : {}),
        ...(editReward !== (editTask.rewardPoints ?? 10) ? { rewardPoints: editReward } : {}),
        ...(Number(editPenalty) !== Number(editTask.penaltyFine ?? 50)
          ? { penaltyFine: Number(editPenalty) }
          : {}),
      });
      toast.success('Task updated');
      setEditTask(null);
      load();
    } catch {
      toast.error('Failed to update task');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteTask = async (taskToDelete?: Task | null) => {
    const target = taskToDelete ?? editTask;
    if (!target || !confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await tasksApi.delete(houseId, target.id);
      toast.success('Task deleted');
      setEditTask(null);
      setViewTask(null);
      load();
    } catch {
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTask) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (proofFile) fd.append('proof', proofFile);
      if (proofNote) fd.append('note', proofNote);
      await tasksApi.submit(houseId, submitTask.id, fd);
      toast.success('Proof submitted!');
      setSubmitTask(null);
      setProofFile(null);
      setProofNote('');
      load();
    } catch {
      toast.error('Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {disputedForUser.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <span className="material-symbols-outlined text-amber-600" style={{ fontSize: '24px' }}>
            warning
          </span>
          <div>
            <p className="font-semibold text-amber-900">
              You have {disputedForUser.length} disputed task
              {disputedForUser.length !== 1 ? 's' : ''} needing resubmission
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Your proof was rejected by housemates. Re-upload with clarification to start a new
              voting round.
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-amber-900 underline hover:no-underline"
              onClick={() => setResubmitTask(disputedForUser[0])}
            >
              Resubmit now →
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: '20px' }}>
              search
            </span>
          </div>
          <input
            className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 pl-12 pr-4 text-sm text-neutral-800 placeholder-neutral-400 transition-all focus:border-black focus:ring-1 focus:ring-black"
            placeholder="Search tasks..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
          </span>
          {isAdmin && (
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                add_task
              </span>
              Assign Task
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-20 text-center text-neutral-400">
          <span className="material-symbols-outlined mb-2 text-neutral-300" style={{ fontSize: '48px' }}>
            task
          </span>
          <p className="text-lg font-semibold text-neutral-700">No tasks yet</p>
          <p className="mt-1 text-sm">Assign a task to get started</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Task Title</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Deadline</th>
                  <th className="px-6 py-4 text-right">Reward</th>
                  <th className="px-6 py-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pagedTasks.map((task, idx) => {
                  const isAssignee = task.assignedTo === user?.id;
                  const canSubmit = isAssignee && task.status === 'pending';
                  const canResubmit = isAssignee && task.status === 'disputed';
                  const vs = voteStatuses[task.id];
                  const canVote =
                    task.status === 'submitted' &&
                    !isAssignee &&
                    !vs?.userVote &&
                    !vs?.votingComplete;
                  const hasVoted = !!vs?.userVote;
                  const taskStyle = TASK_ICON_STYLES[idx % TASK_ICON_STYLES.length];
                  const isOverdue = task.status === 'expired' || task.status === 'rejected';

                  return (
                    <tr
                      key={task.id}
                      className={`group cursor-pointer transition-all duration-200 hover:bg-neutral-50 ${
                        isOverdue ? 'bg-red-50 hover:bg-red-100' : ''
                      }`}
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest('button')) {
                          setViewTask(task);
                        }
                      }}
                    >
                      <td className="px-6 py-4 font-medium text-neutral-800">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${taskStyle.bg} ${taskStyle.text} transition-transform group-hover:scale-105`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                              {taskStyle.icon}
                            </span>
                          </div>
                          <div>
                            <span className="text-base">{task.title}</span>
                            {task.status === 'submitted' && vs && (
                              <p className="mt-0.5 text-xs text-neutral-500">
                                {vs.votesCast}/{vs.eligibleVoters} votes · need {vs.tallies.required}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
                            {members
                              .find((m) => m.userId === task.assignedTo)
                              ?.user?.name?.[0]
                              ?.toUpperCase() ?? '?'}
                          </div>
                          <span
                            className={
                              isAssignee
                                ? 'font-semibold text-black'
                                : 'font-medium text-neutral-600'
                            }
                          >
                            {isAssignee
                              ? 'You'
                              : members.find((m) => m.userId === task.assignedTo)?.user?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(task.status)}`}
                        >
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 ${isOverdue ? 'font-medium text-red-600' : 'text-neutral-500'}`}
                      >
                        {task.deadline ? format(new Date(task.deadline), 'MMM d, h:mm a') : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">
                        +{task.rewardPoints ?? 10} pts
                      </td>
                      <td className="px-6 py-4 text-center">
                        {canSubmit && (
                          <button
                            onClick={() => setSubmitTask(task)}
                            className="mx-auto flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-all hover:bg-black hover:text-white"
                            title="Submit Proof"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              upload
                            </span>
                          </button>
                        )}
                        {canResubmit && (
                          <button
                            onClick={() => setResubmitTask(task)}
                            className="mx-auto flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition-all hover:bg-amber-600 hover:text-white"
                            title="Resubmit Proof"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              replay
                            </span>
                          </button>
                        )}
                        {canVote && (
                          <button
                            onClick={() => setVoteTask(task)}
                            className="mx-auto flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white"
                            title="Review & Vote"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              fact_check
                            </span>
                          </button>
                        )}
                        {hasVoted && task.status === 'submitted' && !isAssignee && (
                          <span className="mx-auto inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                            Voted
                          </span>
                        )}
                        {isAdminEditable(task.status) && (
                          <button
                            onClick={() => openEditModal(task)}
                            className="mx-auto flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-all hover:bg-neutral-800 hover:text-white"
                            title="Edit task"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              edit
                            </span>
                          </button>
                        )}
                        {!canSubmit &&
                          !canResubmit &&
                          !canVote &&
                          !hasVoted &&
                          !isAdminEditable(task.status) && (
                          <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-neutral-50 text-neutral-400 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              check
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              chevron_left
            </span>
          </button>
          <span className="text-sm font-medium text-neutral-600">
            Page {page} of {pages}
          </span>
          <button
            className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              chevron_right
            </span>
          </button>
        </div>
      )}

      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Edit Task">
        {editTask && (
          <form onSubmit={handleEditTask} className="flex flex-col gap-4">
            {editTask.status !== 'pending' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Reassigning this task resets it to pending and clears the current voting round.
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold">Title</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Assign To</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Due Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                value={editDue}
                onChange={(e) => setEditDue(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">Reward Points</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={editReward}
                  onChange={(e) => setEditReward(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Penalty Fine (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={editPenalty}
                  onChange={(e) => setEditPenalty(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              {isAdminEditable(editTask.status) && (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  disabled={deleting}
                  onClick={() => handleDeleteTask()}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
              <button
                type="button"
                className="flex-1 rounded-lg bg-neutral-100 py-2 font-semibold"
                onClick={() => setEditTask(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-black py-2 font-semibold text-white"
                disabled={editing}
              >
                {editing ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Task" size="lg">
        <form onSubmit={handleAssign} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Title</label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              placeholder="Clean the kitchen"
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Description</label>
            <textarea
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              rows={2}
              placeholder="Details…"
              value={assignDesc}
              onChange={(e) => setAssignDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Assign To</label>
            <select
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              value={assignUser}
              onChange={(e) => setAssignUser(e.target.value)}
            >
              <option value="">Auto Assign (Fair Rotation)</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Due Date</label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              type="date"
              value={assignDue}
              onChange={(e) => setAssignDue(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Weight (points)</label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              type="number"
              min={1}
              max={10}
              value={assignWeight}
              onChange={(e) => setAssignWeight(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2 mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecurring"
              checked={assignIsRecurring}
              onChange={(e) => setAssignIsRecurring(e.target.checked)}
              className="rounded border-neutral-300 text-black focus:ring-black"
            />
            <label htmlFor="isRecurring" className="text-sm font-semibold text-neutral-800">
              Make this a recurring chore (auto-rotates when completed)
            </label>
          </div>
          <p className="col-span-2 -mt-2 text-xs text-neutral-500">
            Completed chores automatically assign to the next fair housemate. Uncheck for one-off tasks.
          </p>
          {assignIsRecurring && (
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-semibold text-neutral-800">Repeat Schedule</label>
              <select
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
                value={assignCronSchedule}
                onChange={(e) => setAssignCronSchedule(e.target.value)}
                required={assignIsRecurring}
              >
                <option value="">Select frequency…</option>
                <option value="0 0 * * *">Daily</option>
                <option value="0 0 * * 0">Weekly</option>
                <option value="0 0 1 * *">Monthly</option>
              </select>
            </div>
          )}
          <div className="col-span-2 mt-4 flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg bg-neutral-100 py-2 font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
              onClick={() => setShowAssign(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-black py-2 font-semibold text-white transition-colors hover:bg-neutral-800"
              disabled={assigning}
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!submitTask} onClose={() => setSubmitTask(null)} title="Submit Proof">
        <form onSubmit={handleSubmitProof} className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">
            Task: <span className="font-semibold text-black">{submitTask?.title}</span>
          </p>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">
              Proof Image (optional)
            </label>
            <input
              className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-800">Note</label>
            <textarea
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black"
              rows={3}
              placeholder="Describe what you did…"
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg bg-neutral-100 py-2 font-semibold text-neutral-700 hover:bg-neutral-200"
              onClick={() => setSubmitTask(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-black py-2 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

      <VoteModal
        task={voteTask}
        houseId={houseId}
        onClose={() => setVoteTask(null)}
        onVoted={load}
      />

      <ResubmitModal
        task={resubmitTask}
        houseId={houseId}
        onClose={() => setResubmitTask(null)}
        onSubmitted={load}
      />

      <TaskDetailsModal
        task={viewTask}
        members={members}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onClose={() => setViewTask(null)}
        onSubmitProof={() => {
          if (viewTask) {
            setSubmitTask(viewTask);
            setViewTask(null);
          }
        }}
        onResubmit={() => {
          if (viewTask) {
            setResubmitTask(viewTask);
            setViewTask(null);
          }
        }}
        onVote={() => {
          if (viewTask) {
            setVoteTask(viewTask);
            setViewTask(null);
          }
        }}
        onEdit={() => {
          if (viewTask) {
            openEditModal(viewTask);
            setViewTask(null);
          }
        }}
        onDelete={() => {
          if (viewTask) handleDeleteTask(viewTask);
        }}
      />
    </div>
  );
}
