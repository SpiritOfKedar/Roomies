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
    pending:   'bg-slate-800/80 text-slate-300 ring-slate-500/30',
    submitted: 'bg-blue-500/10 text-blue-400 ring-blue-500/30',
    completed: 'bg-green-500/10 text-green-400 ring-green-500/30',
    overdue:   'bg-red-500/10 text-red-400 ring-red-500/40 animate-pulse',
    rejected:  'bg-red-500/10 text-red-400 ring-red-500/30',
    expired:   'bg-orange-500/10 text-orange-400 ring-orange-500/30',
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
        assignedTo: assignUser,
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '20px' }}>search</span>
          </div>
          <input
            className="block w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] focus:bg-black/50 transition-all"
            placeholder="Search tasks..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{total} task{total !== 1 ? 's' : ''}</span>
          {isAdmin && (
            <button
              onClick={() => setShowAssign(true)}
              className="bg-gradient-to-r from-[#22d3ee] to-blue-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_task</span>
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Task table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>task</span>
          <p className="text-lg font-semibold text-slate-300">No tasks yet</p>
          <p className="text-sm mt-1">Assign a task to get started</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black/20 text-slate-400 uppercase text-xs tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-5">Task Title</th>
                  <th className="px-6 py-5">Assigned To</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Deadline</th>
                  <th className="px-6 py-5 text-right">Reward</th>
                  <th className="px-6 py-5 text-right">Penalty</th>
                  <th className="px-6 py-5 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.map((task, idx) => {
                  const isAssignee = task.assignedTo === user?.id;
                  const canSubmit = isAssignee && task.status === 'pending';
                  const canVote = isAdmin && task.status === 'submitted';
                  const taskStyle = TASK_ICON_STYLES[idx % TASK_ICON_STYLES.length];
                  const isOverdue = task.status === 'expired' || task.status === 'rejected';
                  return (
                    <tr key={task.id} className={`bg-white/5 hover:bg-white/10 transition-all duration-300 border-b border-white/5 group ${isOverdue ? 'bg-red-900/10 hover:bg-red-900/20' : ''}`}>
                      <td className="px-6 py-5 font-medium text-slate-200">
                        <div className="flex items-center gap-4">
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${taskStyle.bg} ${taskStyle.text} ring-1 ${taskStyle.ring} group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{taskStyle.icon}</span>
                          </div>
                          <span className="text-base">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/5">
                            {members.find(m => m.userId === task.assignedTo)?.user?.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className={isAssignee ? 'text-[#22d3ee] font-bold' : 'text-slate-400 font-medium'}>
                            {isAssignee ? 'You' : members.find(m => m.userId === task.assignedTo)?.user?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <DarkStatusBadge status={task.status} />
                      </td>
                      <td className={`px-6 py-5 ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                        {task.deadline ? format(new Date(task.deadline), 'MMM d, h:mm a') : '—'}
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-green-400 drop-shadow-sm">+{(task.weight ?? 1) * 10} pts</td>
                      <td className="px-6 py-5 text-right font-bold text-red-400 drop-shadow-sm">-{(task.weight ?? 1) * 5} pts</td>
                      <td className="px-6 py-5 text-center">
                        {canSubmit && (
                          <button
                            onClick={() => setSubmitTask(task)}
                            className="flex items-center justify-center size-9 rounded-lg bg-[#22d3ee]/10 text-[#22d3ee] hover:bg-[#22d3ee] hover:text-[#0f172a] transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] mx-auto"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                          </button>
                        )}
                        {canVote && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleVote(task.id, 'approve')}
                              className="flex items-center justify-center size-9 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                            </button>
                            <button
                              onClick={() => handleVote(task.id, 'reject')}
                              className="flex items-center justify-center size-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                          </div>
                        )}
                        {!canSubmit && !canVote && (
                          <div className="flex items-center justify-center size-9 rounded-lg bg-white/5 text-slate-500 opacity-40 mx-auto">
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
        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            className="size-9 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
          </button>
          <span className="text-sm text-slate-400">Page {page} of {pages}</span>
          <button
            className="size-9 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
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
            <label className="label">Title</label>
            <input className="input" placeholder="Clean the kitchen" value={assignTitle}
              onChange={e => setAssignTitle(e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Details…"
              value={assignDesc} onChange={e => setAssignDesc(e.target.value)} />
          </div>
          <div>
            <label className="label">Assign To</label>
            <select className="input" value={assignUser} onChange={e => setAssignUser(e.target.value)} required>
              <option value="">Select member…</option>
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.user?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} />
          </div>
          <div>
            <label className="label">Weight (points)</label>
            <input className="input" type="number" min={1} max={10} value={assignWeight}
              onChange={e => setAssignWeight(Number(e.target.value))} />
          </div>
          <div className="col-span-2 flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowAssign(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Proof Modal */}
      <Modal open={!!submitTask} onClose={() => setSubmitTask(null)} title="Submit Proof">
        <form onSubmit={handleSubmitProof} className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">Task: <span className="font-semibold text-white">{submitTask?.title}</span></p>
          <div>
            <label className="label">Proof Image (optional)</label>
            <input className="input" type="file" accept="image/*"
              onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="label">Note</label>
            <textarea className="input resize-none" rows={3} placeholder="Describe what you did…"
              value={proofNote} onChange={e => setProofNote(e.target.value)} />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setSubmitTask(null)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
