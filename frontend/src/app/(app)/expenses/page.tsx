'use client';
import { useState, useEffect, useCallback } from 'react';
import { housesApi, expensesApi } from '@/lib/endpoints';
import type { House, Expense } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/currency';
import { Icon } from '@/components/Icon';

const CATEGORY_ICONS = ['wifi', 'shopping_cart', 'water_drop', 'cleaning_services', 'restaurant', 'local_gas_station', 'electric_bolt', 'build'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [allExpenses, setAllExpenses] = useState<{ expense: Expense; house: House }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Add expense modal
  const [showAdd, setShowAdd] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addReceipt, setAddReceipt] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const houseRes = await housesApi.list();
      const houseList: House[] = houseRes.data.data ?? [];
      setHouses(houseList);

      const expPromises = houseList.map(async (h) => {
        try {
          const res = await expensesApi.list(h.id, 1, 100);
          return (res.data.data?.items ?? []).map((e: Expense) => ({ expense: e, house: h }));
        } catch {
          return [];
        }
      });
      const results = await Promise.all(expPromises);
      const flat = results.flat().sort(
        (a, b) => new Date(b.expense.createdAt).getTime() - new Date(a.expense.createdAt).getTime()
      );
      setAllExpenses(flat);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRow = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse) { toast.error('Select a house'); return; }
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('description', addTitle);
      fd.append('amount', addAmount);
      if (addReceipt) fd.append('receipt', addReceipt);
      await expensesApi.create(selectedHouse, fd);
      toast.success('Expense added!');
      setShowAdd(false);
      setAddTitle(''); setAddAmount(''); setAddReceipt(null); setSelectedHouse('');
      load();
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setAdding(false);
    }
  };

  const handleSettle = async (expense: Expense, splitId: string) => {
    try {
      await expensesApi.settleSplit(expense.houseId, expense.id, splitId);
      toast.success('Split settled!');
      load();
    } catch {
      toast.error('Failed to settle');
    }
  };

  const totalSpending = allExpenses.reduce((s, e) => s + Number(e.expense.amount), 0);
  const totalOwed = allExpenses
    .flatMap(e => e.expense.splits ?? [])
    .filter(s => s.owedBy === user?.id && s.status !== 'settled')
    .reduce((s, sp) => s + Number(sp.amount), 0);
  const totalOwedToYou = allExpenses
    .filter(e => e.expense.paidBy === user?.id)
    .flatMap(e => e.expense.splits ?? [])
    .filter(s => s.owedBy !== user?.id && s.status !== 'settled')
    .reduce((s, sp) => s + Number(sp.amount), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#171717]">Expenses</h1>
          <p className="text-[#737373] text-sm mt-1">Shared expenses across all your houses</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
          <Icon name="add" size={18} />
          Add Expense
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Total Spending</span>
            <Icon name="account_balance_wallet" size={18} className="text-[#737373]" />
          </div>
          <span className="text-3xl font-extrabold text-[#171717]">{formatINR(totalSpending)}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">You are owed</span>
            <Icon name="arrow_upward" size={18} className="text-emerald-500" />
          </div>
          <span className="text-3xl font-extrabold text-emerald-600">+{formatINR(totalOwedToYou)}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">You owe</span>
            <Icon name="arrow_downward" size={18} className="text-red-500" />
          </div>
          <span className={`text-3xl font-extrabold ${totalOwed > 0 ? 'text-red-600' : 'text-[#737373]'}`}>
            {formatINR(totalOwed)}
          </span>
        </div>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : allExpenses.length === 0 ? (
        <div className="text-center py-20">
          <Icon name="receipt_long" size={56} className="text-neutral-300 mb-3" />
          <p className="text-lg font-semibold text-[#171717]">No expenses yet</p>
          <p className="text-sm text-[#737373] mt-1">Add an expense to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-bold text-[#737373] uppercase tracking-wider">
            <div className="col-span-1">Date</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2">House</div>
            <div className="col-span-2">Paid by</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1 text-center">Detail</div>
          </div>

          {allExpenses.map(({ expense: exp, house }, idx) => (
            <div key={exp.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors">
              <div
                className="grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer"
                onClick={() => toggleRow(exp.id)}
              >
                <div className="col-span-2 md:col-span-1 flex flex-col">
                  <span className="text-sm font-bold text-[#171717]">{format(new Date(exp.createdAt), 'MMM d')}</span>
                  <span className="text-xs text-[#737373]">{format(new Date(exp.createdAt), 'yyyy')}</span>
                </div>
                <div className="col-span-10 md:col-span-4 flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-neutral-100 flex items-center justify-center text-[#737373] shrink-0">
                    <Icon name={CATEGORY_ICONS[idx % CATEGORY_ICONS.length]} size={20} />
                  </div>
                  <h3 className="font-bold text-[#171717] truncate">{exp.description}</h3>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <span className="text-sm text-[#737373] font-medium flex items-center gap-1">
                    <Icon name="home" size={14} />
                    {house.name}
                  </span>
                </div>
                <div className="col-span-4 md:col-span-2 flex items-center gap-2">
                  <div className="size-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-[#171717]">
                    {exp.paidBy === user?.id ? 'Y' : (house.members?.find(m => m.userId === exp.paidBy)?.user?.name?.[0]?.toUpperCase() ?? '?')}
                  </div>
                  <span className="text-sm text-[#171717] font-medium">
                    {exp.paidBy === user?.id ? 'You' : (house.members?.find(m => m.userId === exp.paidBy)?.user?.name ?? 'Unknown')}
                  </span>
                </div>
                <div className="col-span-4 md:col-span-2 text-right">
                  <span className="text-lg font-bold text-[#171717]">{formatINR(exp.amount)}</span>
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-end md:justify-center">
                  <Icon
                    name="expand_more"
                    size={20}
                    className={`text-[#737373] transition-transform ${expanded.has(exp.id) ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Expanded splits */}
              {expanded.has(exp.id) && (exp.splits?.length ?? 0) > 0 && (
                <div className="px-6 pb-5 pt-2 bg-neutral-50 border-t border-neutral-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#737373] mb-3">Split Details</h4>
                  <div className="space-y-2">
                    {exp.splits.map(split => (
                      <div key={split.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-neutral-200">
                        <div className="flex items-center gap-3">
                          <div className="size-7 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-[#171717]">
                            {split.owedBy === user?.id ? 'Y' : (house.members?.find(m => m.userId === split.owedBy)?.user?.name?.[0]?.toUpperCase() ?? '?')}
                          </div>
                          <span className="text-sm font-medium text-[#171717]">
                            {split.owedBy === user?.id ? 'You' : (house.members?.find(m => m.userId === split.owedBy)?.user?.name ?? 'Unknown')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${split.status === 'settled'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-red-700 bg-red-50 border-red-200'
                            }`}>
                            {split.status === 'settled' ? 'Settled' : 'Unpaid'}
                          </span>
                          <span className="text-sm font-bold text-[#171717]">{formatINR(split.amount)}</span>
                          {exp.paidBy === user?.id && split.owedBy !== user?.id && split.status !== 'settled' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSettle(exp, split.id); }}
                              className="btn-primary !py-1.5 !px-3 !text-xs"
                            >
                              Mark received
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

      {/* Add Expense Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label className="label">House</label>
            <select className="input" value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} required>
              <option value="">Select a house…</option>
              {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
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
