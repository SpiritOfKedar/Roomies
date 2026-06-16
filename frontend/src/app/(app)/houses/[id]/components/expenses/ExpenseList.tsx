'use client';

import { format } from 'date-fns';
import { Icon } from '@/components/Icon';
import { formatINR } from '@/lib/currency';
import type { Expense, HouseMember } from '@/types';

const EXPENSE_ICONS = [
  'wifi',
  'shopping_cart',
  'water_drop',
  'cleaning_services',
  'restaurant',
  'local_gas_station',
] as const;

type Filter = 'all' | 'settled' | 'unsettled';

interface Props {
  expenses: Expense[];
  members: HouseMember[];
  currentUserId?: string;
  expanded: Set<string>;
  filter: Filter;
  isLoading: boolean;
  onToggle: (id: string) => void;
  onSettle: (expenseId: string, splitId: string) => void;
}

function expenseMatchesFilter(exp: Expense, filter: Filter, userId?: string): boolean {
  if (filter === 'all') return true;
  const splits = exp.splits ?? [];
  const mine = splits.filter((s) => s.owedBy === userId);
  if (mine.length === 0) {
    if (filter === 'unsettled') {
      return splits.some((s) => s.status !== 'settled');
    }
    return filter === 'settled' && splits.every((s) => s.status === 'settled');
  }
  if (filter === 'settled') return mine.every((s) => s.status === 'settled');
  return mine.some((s) => s.status !== 'settled');
}

export default function ExpenseList({
  expenses,
  members,
  currentUserId,
  expanded,
  filter,
  isLoading,
  onToggle,
  onSettle,
}: Props) {
  const filtered = expenses.filter((e) => expenseMatchesFilter(e, filter, currentUserId));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
        <Icon name="receipt_long" size={48} className="mx-auto mb-3 text-neutral-300" />
        <p className="text-lg font-semibold text-neutral-800">No expenses yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          {filter === 'all'
            ? 'Add an expense to split costs with your housemates'
            : `No ${filter} expenses on this page`}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="hidden grid-cols-12 gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 md:grid">
        <div className="col-span-2">Date</div>
        <div className="col-span-5">Description</div>
        <div className="col-span-3">Paid by</div>
        <div className="col-span-1 text-right">Amount</div>
        <div className="col-span-1" />
      </div>

      {filtered.map((exp, idx) => {
        const payer =
          exp.paidBy === currentUserId
            ? 'You'
            : members.find((m) => m.userId === exp.paidBy)?.user?.name ?? 'Unknown';
        const isOpen = expanded.has(exp.id);

        return (
          <div key={exp.id} className="border-b border-neutral-100 last:border-0">
            <button
              type="button"
              onClick={() => onToggle(exp.id)}
              className="grid w-full grid-cols-2 gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50 md:grid-cols-12 md:items-center md:gap-4"
            >
              <div className="col-span-2 md:col-span-2">
                <p className="text-sm font-bold text-neutral-900">
                  {format(new Date(exp.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="col-span-10 flex items-center gap-3 md:col-span-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                  <Icon name={EXPENSE_ICONS[idx % EXPENSE_ICONS.length]} size={20} />
                </div>
                <p className="font-semibold text-neutral-900">{exp.description}</p>
              </div>
              <div className="col-span-6 flex items-center gap-2 md:col-span-3">
                <div className="flex size-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">
                  {payer[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="text-sm text-neutral-600">{payer}</span>
              </div>
              <div className="col-span-4 text-right md:col-span-1">
                <span className="text-base font-bold text-neutral-900">{formatINR(exp.amount)}</span>
              </div>
              <div className="col-span-2 flex justify-end md:col-span-1 md:justify-center">
                <Icon
                  name="expand_more"
                  size={20}
                  className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isOpen && (exp.splits?.length ?? 0) > 0 && (
              <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Split breakdown
                </p>
                <div className="space-y-2">
                  {exp.splits!.map((split) => {
                    const name =
                      split.owedBy === currentUserId
                        ? 'You'
                        : members.find((m) => m.userId === split.owedBy)?.user?.name ?? 'Unknown';
                    const settled = split.status === 'settled';
                    return (
                      <div
                        key={split.id}
                        className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">
                            {name[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-medium text-neutral-800">{name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                              settled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {settled ? 'Settled' : 'Unpaid'}
                          </span>
                          <span className="text-sm font-bold text-neutral-900">
                            {formatINR(split.amount)}
                          </span>
                          {split.owedBy === currentUserId && !settled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSettle(exp.id, split.id);
                              }}
                              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                            >
                              Mark paid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
