'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { expensesApi } from '@/lib/endpoints';
import { Icon } from '@/components/Icon';
import type { HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useHouseExpenses } from './useHouseExpenses';
import ExpenseSummaryCards from './ExpenseSummaryCards';
import ExpenseList from './ExpenseList';
import AddExpenseModal from './AddExpenseModal';

interface Props {
  houseId: string;
  members: HouseMember[];
}

type Filter = 'all' | 'settled' | 'unsettled';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unsettled', label: 'Unsettled' },
  { id: 'settled', label: 'Settled' },
];

export default function ExpensesTab({ houseId, members }: Props) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addReceipt, setAddReceipt] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const { expenses, total, pageSize, isLoading, refresh } = useHouseExpenses(houseId, page);
  const pages = Math.ceil(total / pageSize);

  const totalSpending = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const youOwe = expenses
    .flatMap((e) => e.splits ?? [])
    .filter((s) => s.owedBy === user?.id && s.status !== 'settled')
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const owedToYou = expenses
    .filter((e) => e.paidBy === user?.id)
    .flatMap((e) => e.splits ?? [])
    .filter((s) => s.owedBy !== user?.id && s.status !== 'settled')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

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
      setAddTitle('');
      setAddAmount('');
      setAddReceipt(null);
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
      toast.success('Marked as settled');
      refresh();
    } catch {
      toast.error('Failed to settle');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ExpenseSummaryCards
        totalSpending={totalSpending}
        owedToYou={owedToYou}
        youOwe={youOwe}
      />

      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
                filter === f.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
          <Icon name="add" size={18} />
          Add Expense
        </button>
      </div>

      <ExpenseList
        expenses={expenses}
        members={members}
        currentUserId={user?.id}
        expanded={expanded}
        filter={filter}
        isLoading={isLoading}
        onToggle={toggleRow}
        onSettle={handleSettle}
      />

      {pages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-neutral-500">
            Page {page} of {pages} · {total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <Icon name="chevron_left" size={18} />
            </button>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>
        </div>
      )}

      <AddExpenseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={addTitle}
        amount={addAmount}
        receipt={addReceipt}
        adding={adding}
        onTitleChange={setAddTitle}
        onAmountChange={setAddAmount}
        onReceiptChange={setAddReceipt}
        onSubmit={handleAdd}
      />
    </div>
  );
}
