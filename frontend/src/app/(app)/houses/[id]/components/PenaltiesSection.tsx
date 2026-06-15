'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { penaltiesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { Penalty, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/currency';

interface Props { houseId: string; members: HouseMember[]; isAdmin: boolean; }

export default function PenaltiesSection({ houseId, members, isAdmin }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: penalties = [], isLoading } = useQuery({
    queryKey: queryKeys.penalties(houseId),
    queryFn: async () => {
      const res = await penaltiesApi.list(houseId);
      return res.data.data ?? [];
    },
    enabled: !!houseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.penalties(houseId) });
  };

  const handleSettle = async (penaltyId: string) => {
    try {
      await penaltiesApi.settle(houseId, penaltyId);
      toast.success('Penalty settled!');
      refresh();
    } catch {
      toast.error('Failed to settle penalty');
    }
  };

  if (isLoading) return <div className="h-24 rounded-xl bg-white/5 animate-pulse" />;

  if (penalties.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl text-center py-16 text-slate-400">
        <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>sentiment_satisfied</span>
        <p className="text-lg font-semibold text-slate-300">No penalties</p>
        <p className="text-sm mt-1">Everyone&apos;s been good!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/20 border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
        <div className="col-span-2">Member</div>
        <div className="col-span-4">Reason</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-1 text-center">Status</div>
        {isAdmin && <div className="col-span-1 text-center">Action</div>}
      </div>

      {penalties.map(penalty => {
        const isMe = penalty.userId === user?.id;
        return (
          <div
            key={penalty.id}
            className={`grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-5 items-center border-b border-white/5 last:border-0 transition-colors ${isMe ? 'bg-red-900/10' : 'hover:bg-white/5'}`}
          >
            <div className="col-span-2 flex items-center gap-3">
              <div className="size-8 rounded-full bg-red-900/30 flex items-center justify-center text-sm font-bold text-red-400 ring-1 ring-red-700/30">
                {members.find(m => m.userId === penalty.userId)?.user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="font-bold text-white text-sm">
                {members.find(m => m.userId === penalty.userId)?.user?.name ?? '—'}
                {isMe && <span className="text-[#22d3ee] text-xs ml-1">(you)</span>}
              </span>
            </div>
            <div className="col-span-4 text-sm text-slate-300 truncate max-w-xs">{penalty.reason}</div>
            <div className="col-span-2 text-right">
              <span className="text-red-400 font-bold text-base">−{formatINR(penalty.fineAmount)}</span>
            </div>
            <div className="col-span-2 text-sm text-slate-400 font-medium">{format(new Date(penalty.createdAt), 'MMM d, yyyy')}</div>
            <div className="col-span-1 flex justify-center">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                penalty.status === 'settled'
                  ? 'text-green-400 bg-green-900/30 border-green-700/40'
                  : 'text-red-400 bg-red-900/30 border-red-700/40'
              }`}>
                {penalty.status}
              </span>
            </div>
            {isAdmin && (
              <div className="col-span-1 flex justify-center">
                {penalty.status !== 'settled' && (
                  <button
                    onClick={() => handleSettle(penalty.id)}
                    className="text-xs px-3 py-1.5 bg-[#22d3ee]/10 text-[#22d3ee] rounded-lg hover:bg-[#22d3ee] hover:text-[#0f172a] transition-all font-bold"
                  >
                    Settle
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
