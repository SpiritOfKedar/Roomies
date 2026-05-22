'use client';
import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '@/lib/endpoints';
import type { Task, HouseMember } from '@/types';
import Modal from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Props { houseId: string; members: HouseMember[]; isAdmin: boolean; }

/* Status badge colors for dark theme */
function DarkStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-800/80 text-slate-300 ring-slate-500/30',
    submitted: 'bg-blue-500/10 text-blue-400 ring-blue-500/30',
    completed: 'bg-green-500/10 text-green-400 ring-green-500/30',
    overdue: 'bg-red-500/10 text-red-400 ring-red-500/40 animate-pulse',
    rejected: 'bg-red-500/10 text-red-400 ring-red-500/30',
    expired: 'bg-orange-500/10 text-orange-400 ring-orange-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${styles[status] ?? styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* Task icon colors */
const TASK_ICON_STYLES = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20', icon: 'water_drop' },
  { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20', icon: 'delete' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20', icon: 'wifi' },
  { bg: 'bg-green-500/10', text: 'text-green-400', ring: 'ring-green-500/20', icon: 'cleaning_services' },
  { bg: 'bg-pink-500/10', text: 'text-pink-400', ring: 'ring-pink-500/20', icon: 'shopping_cart' },
];

export default function TasksTab({ houseId, members, isAdmin }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assignWeight, setAssignWeight] = useState(1);
  const [assigning, setAssigning] = useState(false);

  // Submit proof modal
  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review & Vote modal
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tasksApi.list(houseId, page, limit);
      setTasks(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [houseId, page]);

  useEffect(() => { load(); }, [load]);

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
      });
      toast.success('Task assigned!');
      setShowAssign(false);
      setAssignTitle(''); setAssignDesc(''); setAssignDue('');
      setAssignUser(''); setAssignWeight(1);
      load();
    } catch {
      toast.error('Failed to assign task');
    } finally {
      setAssigning(false);
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
      setProofFile(null); setProofNote('');
      load();
    } catch {
      toast.error('Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (taskId: string, vote: 'approve' | 'reject') => {
    try {
      await tasksApi.vote(houseId, taskId, vote);
      toast.success(`Vote ${vote}d`);
      load();
    } catch {
      toast.error('Vote failed');
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar + controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center bg-white p-4 rounded-xl border border-neutral-200">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: '20px' }}>search</span>
          </div>
          <input
            className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 pl-12 pr-4 text-sm text-neutral-800 placeholder-neutral-400 focus:border-black focus:ring-1 focus:ring-black transition-all"
            placeholder="Search tasks..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{total} task{total !== 1 ? 's' : ''}</span>
          {isAdmin && (
            <button
              onClick={() => setShowAssign(true)}
              className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_task</span>
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Task table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <span className="material-symbols-outlined mb-2 text-neutral-300" style={{ fontSize: '48px' }}>task</span>
          <p className="text-lg font-semibold text-neutral-700">No tasks yet</p>
          <p className="text-sm mt-1">Assign a task to get started</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs tracking-wider font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4">Task Title</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Deadline</th>
                  <th className="px-6 py-4 text-right">Reward</th>
                  <th className="px-6 py-4 text-right">Penalty</th>
                  <th className="px-6 py-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tasks.map((task, idx) => {
                  const isAssignee = task.assignedTo === user?.id;
                  const canSubmit = isAssignee && task.status === 'pending';
                  const canVote = task.status === 'submitted' && !isAssignee;
                  const taskStyle = TASK_ICON_STYLES[idx % TASK_ICON_STYLES.length];
                  const isOverdue = task.status === 'expired' || task.status === 'rejected';
                  return (
                    <tr key={task.id} className={`hover:bg-neutral-50 transition-all duration-200 group ${isOverdue ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                      <td className="px-6 py-4 font-medium text-neutral-800">
                        <div className="flex items-center gap-4">
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${taskStyle.bg} ${taskStyle.text} group-hover:scale-105 transition-transform`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{taskStyle.icon}</span>
                          </div>
                          <span className="text-base">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                            {members.find(m => m.userId === task.assignedTo)?.user?.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className={isAssignee ? 'text-black font-semibold' : 'text-neutral-600 font-medium'}>
                            {isAssignee ? 'You' : members.find(m => m.userId === task.assignedTo)?.user?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          task.status === 'pending' ? 'bg-neutral-50 text-neutral-600 ring-neutral-500/10' :
                          task.status === 'submitted' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' :
                          task.status === 'completed' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          task.status === 'expired' || task.status === 'rejected' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                          'bg-neutral-50 text-neutral-600 ring-neutral-500/10'
                        }`}>
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-500'}`}>
                        {task.deadline ? format(new Date(task.deadline), 'MMM d, h:mm a') : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">+{(task.weight ?? 1) * 10} pts</td>
                      <td className="px-6 py-4 text-right font-semibold text-red-600">-{(task.weight ?? 1) * 5} pts</td>
                      <td className="px-6 py-4 text-center">
                        {canSubmit && (
                          <button
                            onClick={() => setSubmitTask(task)}
                            className="flex items-center justify-center size-9 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-black hover:text-white transition-all mx-auto"
                            title="Submit Proof"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                          </button>
                        )}
                        {canVote && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setReviewTask(task)}
                              className="flex items-center justify-center size-9 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                              title="Review & Vote"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>fact_check</span>
                            </button>
                          </div>
                        )}
                        {!canSubmit && !canVote && (
                          <div className="flex items-center justify-center size-9 rounded-lg bg-neutral-50 text-neutral-400 opacity-50 mx-auto">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            className="size-9 flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors disabled:opacity-40"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
          </button>
          <span className="text-sm font-medium text-neutral-600">Page {page} of {pages}</span>
          <button
            className="size-9 flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors disabled:opacity-40"
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
          </button>
        </div>
      )}

      {/* Assign Task Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Task" size="lg">
        <form onSubmit={handleAssign} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Title</label>
            <input className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black" placeholder="Clean the kitchen" value={assignTitle}
              onChange={e => setAssignTitle(e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black resize-none" rows={2} placeholder="Details…"
              value={assignDesc} onChange={e => setAssignDesc(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Assign To</label>
            <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black" value={assignUser} onChange={e => setAssignUser(e.target.value)}>
              <option value="">Auto Assign (Rotation)</option>
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.user?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Due Date</label>
            <input className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black" type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Weight (points)</label>
            <input className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black" type="number" min={1} max={10} value={assignWeight}
              onChange={e => setAssignWeight(Number(e.target.value))} />
          </div>
          <div className="col-span-2 flex gap-3 mt-4">
            <button type="button" className="flex-1 py-2 font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" onClick={() => setShowAssign(false)}>Cancel</button>
            <button type="submit" className="flex-1 py-2 font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors" disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Proof Modal */}
      <Modal open={!!submitTask} onClose={() => setSubmitTask(null)} title="Submit Proof">
        <form onSubmit={handleSubmitProof} className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">Task: <span className="font-semibold text-black">{submitTask?.title}</span></p>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Proof Image (optional)</label>
            <input className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200" type="file" accept="image/*"
              onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">Note</label>
            <textarea className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900 focus:border-black focus:ring-1 focus:ring-black resize-none" rows={3} placeholder="Describe what you did…"
              value={proofNote} onChange={e => setProofNote(e.target.value)} />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="button" className="flex-1 py-2 font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" onClick={() => setSubmitTask(null)}>Cancel</button>
            <button type="submit" className="flex-1 py-2 font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review & Vote Modal */}
      <Modal open={!!reviewTask} onClose={() => setReviewTask(null)} title="Review Proof">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">Task: <span className="font-semibold text-black">{reviewTask?.title}</span></p>
          {reviewTask?.imageUrl && (
            <div className="w-full rounded-lg overflow-hidden border border-neutral-200 mt-2">
              <img src={reviewTask.imageUrl} alt="Task proof" className="w-full h-auto max-h-64 object-cover" />
            </div>
          )}
          <p className="text-sm text-neutral-500 mt-2 italic">Please review the proof before approving or rejecting.</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (reviewTask) {
                  handleVote(reviewTask.id, 'reject');
                  setReviewTask(null);
                }
              }}
              className="flex-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-semibold py-2 rounded-lg transition-all"
            >
              Reject
            </button>
            <button
              onClick={() => {
                if (reviewTask) {
                  handleVote(reviewTask.id, 'approve');
                  setReviewTask(null);
                }
              }}
              className="flex-1 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white font-semibold py-2 rounded-lg transition-all"
            >
              Approve
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
