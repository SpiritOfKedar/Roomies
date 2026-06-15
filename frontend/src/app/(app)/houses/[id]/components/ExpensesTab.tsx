'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { Expense, HouseMember } from '@/types';
import Modal from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { formatINR } from '@/lib/currency';
import { format } from 'date-fns';

interface Props { houseId: string; members: HouseMember[]; }

/* Expense category icons */
const EXPENSE_ICONS = ['wifi', 'shopping_cart', 'water_drop', 'cleaning_services', 'restaurant', 'local_gas_station'];

export default function ExpensesTab({ houseId, members }: Props) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addReceipt, setAddReceipt] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.expenses(houseId, page),
    queryFn: async () => {
      const res = await expensesApi.list(houseId, page, limit);
      return res.data.data;
    },
    enabled: !!houseId,
  });

  const expenses = data?.items ?? [];
  const total = data?.total ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['house', houseId, 'expenses'] });
  };

  const toggleRow = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('description', addTitle);
      fd.append('amount', addAmount);
      if (addReceipt) fd.append('receipt', addReceipt);
      await expensesApi.create(houseId, fd);
      toast.success('Expense added!');
      setShowAdd(false);
      setAddTitle(''); setAddAmount(''); setAddReceipt(null);
      refresh();
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setAdding(false);
    }
  };

  const handleSettle = async (expenseId: string, splitId: string) => {
    try {
      await expensesApi.settleSplit(houseId, expenseId, splitId);
      toast.success('Split settled!');
      refresh();
    } catch {
      toast.error('Failed to settle');
    }
  };

  const pages = Math.ceil(total / limit);
  const totalSpending = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalOwed = expenses
    .flatMap(e => e.splits ?? [])
    .filter(s => s.owedBy === user?.id && s.status !== 'settled')
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const totalOwedToYou = expenses
    .filter(e => e.paidBy === user?.id)
    .flatMap(e => e.splits ?? [])
    .filter(s => s.owedBy !== user?.id && s.status !== 'settled')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-sm flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total Spending</span>
            <span className="p-2 rounded-full bg-white/5 text-slate-300">
              <span className="material-symbols-outlined block" style={{ fontSize: '20px' }}>calendar_month</span>
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{formatINR(totalSpending)}</div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-sm flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">You are owed</span>
            <span className="p-2 rounded-full bg-green-900/20 text-green-400">
              <span className="material-symbols-outlined block" style={{ fontSize: '20px' }}>arrow_upward</span>
            </span>
          </div>
          <div className="text-3xl font-extrabold text-green-400 tracking-tight">+{formatINR(totalOwedToYou)}</div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-sm flex flex-col justify-between h-32">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">You owe</span>
            <span className="p-2 rounded-full bg-white/5 text-slate-500">
              <span className="material-symbols-outlined block" style={{ fontSize: '20px' }}>{totalOwed > 0 ? 'arrow_downward' : 'check'}</span>
            </span>
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${totalOwed > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {formatINR(totalOwed)}
          </div>
        </div>
      </div>

      {/* Filter + Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-bold whitespace-nowrap shadow-md border border-white/10">All</button>
          <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors text-sm font-bold whitespace-nowrap">Settled</button>
          <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors text-sm font-bold whitespace-nowrap">Unsettled</button>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-gradient-to-r from-[#22d3ee] to-blue-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Add Expense
        </button>
      </div>

      {/* Expense table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>receipt_long</span>
          <p className="text-lg font-semibold text-slate-300">No expenses yet</p>
          <p className="text-sm mt-1">Add an expense to get started</p>
        </div>
      ) : (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/20 border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-1">Date</div>
            <div className="col-span-5">Description</div>
            <div className="col-span-3">Payer</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1 text-center">Detail</div>
          </div>

          {expenses.map((exp, idx) => (
            <div key={exp.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
              <div
                className="grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-5 items-center cursor-pointer"
                onClick={() => toggleRow(exp.id)}
              >
                <div className="col-span-2 md:col-span-1 flex flex-col justify-center">
                  <span className="text-sm font-bold text-white">{format(new Date(exp.createdAt), 'MMM d')}</span>
                  <span className="text-xs font-semibold text-slate-500">{format(new Date(exp.createdAt), 'yyyy')}</span>
                </div>
                <div className="col-span-10 md:col-span-5 flex items-center gap-4">
                  <div className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-300 shrink-0 border border-white/10">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{EXPENSE_ICONS[idx % EXPENSE_ICONS.length]}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{exp.description}</h3>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-3 flex items-center gap-2 mt-2 md:mt-0">
                  <div className="size-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/5">
                    {members.find(m => m.userId === exp.paidBy)?.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm font-medium text-slate-300">
                    Paid by <strong>{exp.paidBy === user?.id ? 'You' : members.find(m => m.userId === exp.paidBy)?.user?.name ?? 'Unknown'}</strong>
                  </span>
                </div>
                <div className="col-span-4 md:col-span-2 text-right mt-2 md:mt-0">
                  <span className="text-lg font-bold text-white block">{formatINR(exp.amount)}</span>
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                  <span className={`material-symbols-outlined text-slate-400 hover:text-slate-200 transition-transform ${expanded.has(exp.id) ? 'rotate-180' : ''}`} style={{ fontSize: '20px' }}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded splits */}
              {expanded.has(exp.id) && (exp.splits?.length ?? 0) > 0 && (
                <div className="px-6 pb-6 pt-2 bg-black/20 border-t border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Split Details</h4>
                  <div className="space-y-3">
                    {exp.splits!.map(split => (
                      <div key={split.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                            {members.find(m => m.userId === split.owedBy)?.user?.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-bold text-slate-300">
                            {split.owedBy === user?.id ? 'You' : members.find(m => m.userId === split.owedBy)?.user?.name ?? 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${split.status === 'settled'
                              ? 'text-green-400 bg-green-900/30 border-green-800'
                              : 'text-red-400 bg-red-900/30 border-red-800'
                            }`}>
                            {split.status === 'settled' ? 'Settled' : 'Unpaid'}
                          </span>
                          <span className="text-sm font-bold text-white">{formatINR(split.amount)}</span>
                          {split.owedBy === user?.id && split.status !== 'settled' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSettle(exp.id, split.id); }}
                              className="text-xs px-3 py-1.5 bg-[#22d3ee]/10 text-[#22d3ee] rounded-lg hover:bg-[#22d3ee] hover:text-[#0f172a] transition-all font-bold"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-2 px-2">
          <span className="text-sm text-slate-400 font-medium">Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} expenses</span>
          <div className="flex items-center gap-2">
            <button
              className="size-9 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
            </button>
            <button
              className="size-9 flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Groceries, Utilities…" value={addTitle}
              onChange={e => setAddTitle(e.target.value)} required />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input" type="number" min="0.01" step="0.01" placeholder="0.00"
              value={addAmount} onChange={e => setAddAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label">Receipt (optional)</label>
            <input className="input" type="file" accept="image/*,application/pdf"
              onChange={e => setAddReceipt(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={adding}>
              {adding ? 'Adding…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
