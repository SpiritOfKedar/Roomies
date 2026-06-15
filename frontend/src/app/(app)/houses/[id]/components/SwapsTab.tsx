'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { swapsApi, tasksApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { TaskSwap, Task, HouseMember } from '@/types';
import Modal from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Props { houseId: string; members: HouseMember[]; }

function SwapStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40 shadow-[0_0_6px_rgba(250,204,21,0.15)]',
    accepted: 'text-green-400 bg-green-900/30 border-green-700/40 shadow-[0_0_6px_rgba(34,197,94,0.15)]',
    rejected: 'text-red-400 bg-red-900/30 border-red-700/40 shadow-[0_0_6px_rgba(239,68,68,0.15)]',
  };
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

export default function SwapsTab({ houseId, members }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showPropose, setShowPropose] = useState(false);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [targetTask, setTargetTask] = useState('');
  const [offeredTask, setOfferedTask] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [proposing, setProposing] = useState(false);

  const { data: swaps = [], isLoading } = useQuery({
    queryKey: queryKeys.swaps(houseId),
    queryFn: async () => {
      const swapRes = await swapsApi.list(houseId);
      return swapRes.data.data ?? [];
    },
    enabled: !!houseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.swaps(houseId) });
  };

  const loadMyTasks = async () => {
    try {
      const res = await tasksApi.list(houseId, 1, 100);
      const tasks = res.data.data?.items ?? [];
      setMyTasks(tasks.filter((t: Task) => t.assignedTo === user?.id && t.status === 'pending'));
    } catch {
      toast.error('Failed to load your tasks');
    }
  };

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposing(true);
    try {
      await swapsApi.propose(houseId, {
        offeredTaskId: offeredTask,
        requestedTaskId: targetTask,
        receiverId: targetUser,
      });
      toast.success('Swap proposed!');
      setShowPropose(false);
      setOfferedTask(''); setTargetTask(''); setTargetUser('');
      refresh();
    } catch {
      toast.error('Failed to propose swap');
    } finally {
      setProposing(false);
    }
  };

  const handleResolve = async (swapId: string, action: 'accept' | 'reject') => {
    try {
      await swapsApi.resolve(houseId, swapId, action);
      toast.success(`Swap ${action}ed!`);
      refresh();
    } catch {
      toast.error(`Failed to ${action} swap`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400 font-medium">{swaps.length} swap{swaps.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setShowPropose(true); loadMyTasks(); }}
          className="bg-gradient-to-r from-[#22d3ee] to-blue-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>swap_horiz</span>
          Propose Swap
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : swaps.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>swap_horiz</span>
          <p className="text-lg font-semibold text-slate-300">No swaps yet</p>
          <p className="text-sm mt-1">Propose a task swap to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {swaps.map(swap => {
            const isTarget = swap.receiverId === user?.id;
            const isPending = swap.status === 'pending';
            return (
              <div key={swap.id} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg hover:bg-slate-900/80 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <SwapStatusBadge status={swap.status} />
                      <span className="text-xs text-slate-500 font-medium">
                        {formatDistanceToNow(new Date(swap.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">
                        {members.find(m => m.userId === swap.requesterId)?.user?.name ?? swap.requester?.name}
                      </span>
                      {' '}wants to swap tasks with{' '}
                      <span className="font-bold text-white">
                        {members.find(m => m.userId === swap.receiverId)?.user?.name ?? swap.receiver?.name}
                      </span>
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300">
                        <span className="text-[#22d3ee] mr-1">Offering:</span> Task #{swap.offeredTaskId?.slice(-6)}
                      </span>
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '18px' }}>swap_horiz</span>
                      <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300">
                        <span className="text-purple-400 mr-1">Wants:</span> Task #{swap.requestedTaskId?.slice(-6)}
                      </span>
                    </div>
                  </div>
                  {isTarget && isPending && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleResolve(swap.id, 'accept')}
                        className="text-xs px-4 py-2 bg-green-900/30 text-green-400 rounded-xl hover:bg-green-500 hover:text-white font-bold transition-all border border-green-700/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]">
                        Accept
                      </button>
                      <button onClick={() => handleResolve(swap.id, 'reject')}
                        className="text-xs px-4 py-2 bg-red-900/30 text-red-400 rounded-xl hover:bg-red-500 hover:text-white font-bold transition-all border border-red-700/30 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Swap Modal */}
      <Modal open={showPropose} onClose={() => setShowPropose(false)} title="Propose a Swap">
        <form onSubmit={handlePropose} className="flex flex-col gap-4">
          <div>
            <label className="label">Your Task to Offer</label>
            <select className="input" value={offeredTask} onChange={e => setOfferedTask(e.target.value)} required>
              <option value="">Select one of your tasks…</option>
              {myTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Target Member</label>
            <select className="input" value={targetUser} onChange={e => setTargetUser(e.target.value)} required>
              <option value="">Select member…</option>
              {members.filter(m => m.userId !== user?.id).map(m => (
                <option key={m.userId} value={m.userId}>{m.user?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Task ID to Request</label>
            <input className="input" placeholder="Paste task ID" value={targetTask}
              onChange={e => setTargetTask(e.target.value)} required />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowPropose(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={proposing}>
              {proposing ? 'Proposing…' : 'Propose'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
