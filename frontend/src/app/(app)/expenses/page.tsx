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
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import SubmitButton from '@/components/ui/SubmitButton';
import FileUpload from '@/components/ui/FileUpload';
import { AnimatedCounter } from '@/components/ui/rare/animated-counter';
import { useActionStatus } from '@/hooks/useActionStatus';
import { getApiErrorMessage } from '@/lib/api-error';

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
  const addAction = useActionStatus();

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
    if (!selectedHouse) { toast.error('Pick a house'); return; }
    try {
      const fd = new FormData();
      fd.append('description', addTitle);
      fd.append('amount', addAmount);
      if (addReceipt) fd.append('receipt', addReceipt);
      await addAction.run(() => expensesApi.create(selectedHouse, fd));
      toast.success('Expense added!');
      setShowAdd(false);
      setAddTitle(''); setAddAmount(''); setAddReceipt(null); setSelectedHouse('');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not add the expense'));
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
          <AnimatedCounter value={totalSpending} prefix="₹" grouping="indian" decimals={Number.isInteger(Math.round(totalSpending * 100) / 100) ? 0 : 2} className={"text-3xl font-extrabold text-[#171717]"} />
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">You are owed</span>
            <Icon name="arrow_upward" size={18} className="text-emerald-500" />
          </div>
          <AnimatedCounter value={totalOwedToYou} prefix="+₹" grouping="indian" decimals={Number.isInteger(Math.round(totalOwedToYou * 100) / 100) ? 0 : 2} className={"text-3xl font-extrabold text-emerald-600"} />
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">You owe</span>
            <Icon name="arrow_downward" size={18} className="text-red-500" />
          </div>
          <AnimatedCounter value={totalOwed} prefix="₹" grouping="indian" decimals={Number.isInteger(Math.round(totalOwed * 100) / 100) ? 0 : 2} className={`text-3xl font-extrabold ${totalOwed > 0 ? 'text-red-600' : 'text-[#737373]'}`} />
        </div>
      </div>

      {/* Expense List */}
      {loading ? (
        <Loader label="Loading expenses" />
      ) : allExpenses.length === 0 ? (
        <EmptyState title="No expenses yet" description="Add something you paid for and it gets split with your roommates." />
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
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add an expense"
        footer={
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
            <SubmitButton
              form="global-expense-form"
              status={addAction.status}
              className="flex-1"
              disabled={!selectedHouse || !addTitle.trim() || !(Number(addAmount) > 0)}
              labels={{ running: addReceipt ? 'Uploading receipt…' : 'Adding…', done: 'Added', failed: 'Try again' }}
            >
              Add expense
            </SubmitButton>
          </div>
        }
      >
        <form id="global-expense-form" onSubmit={handleAdd} className="flex flex-col gap-4">
          <Select
            label="House"
            value={selectedHouse}
            onChange={setSelectedHouse}
            placeholder="Pick a house"
            options={houses.map((h) => ({ value: h.id, label: h.name, tag: `${h.members?.filter((m) => m.status === 'active').length ?? 0} people` }))}
          />
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
          <FileUpload
            label="Receipt (optional)"
            accept="image/jpeg,image/png,image/gif,image/webp"
            file={addReceipt}
            onChange={setAddReceipt}
            hint="JPEG, PNG, GIF or WebP · up to 5 MB"
          />
        </form>
      </Modal>
    </div>
  );
}
