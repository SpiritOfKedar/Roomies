'use client';

import { Icon } from '@/components/Icon';
import { formatINR } from '@/lib/currency';

interface Props {
  totalSpending: number;
  owedToYou: number;
  youOwe: number;
}

export default function ExpenseSummaryCards({ totalSpending, owedToYou, youOwe }: Props) {
  const cards = [
    {
      label: 'Total Spending',
      value: formatINR(totalSpending),
      icon: 'receipt_long',
      valueClass: 'text-neutral-900',
      iconBg: 'bg-neutral-100 text-neutral-600',
    },
    {
      label: 'You are owed',
      value: `+${formatINR(owedToYou)}`,
      icon: 'arrow_upward',
      valueClass: 'text-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'You owe',
      value: formatINR(youOwe),
      icon: youOwe > 0 ? 'arrow_downward' : 'check',
      valueClass: youOwe > 0 ? 'text-red-600' : 'text-neutral-500',
      iconBg: youOwe > 0 ? 'bg-red-50 text-red-500' : 'bg-neutral-100 text-neutral-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              {card.label}
            </span>
            <span className={`rounded-lg p-2 ${card.iconBg}`}>
              <Icon name={card.icon} size={18} />
            </span>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${card.valueClass}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
