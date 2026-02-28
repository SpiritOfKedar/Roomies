import clsx from 'clsx';
import type { TaskStatus, SwapStatus, PenaltyStatus } from '@/types';

type AnyStatus = TaskStatus | SwapStatus | PenaltyStatus | 'open' | 'settled' | string;

const MAP: Record<string, string> = {
  pending:   'bg-status-pending/20   text-status-pending',
  submitted: 'bg-status-submitted/20 text-status-submitted',
  completed: 'bg-status-completed/20 text-status-completed',
  rejected:  'bg-status-rejected/20  text-status-rejected',
  expired:   'bg-status-expired/20   text-status-expired',
  disputed:  'bg-status-disputed/20  text-status-disputed',
  open:      'bg-status-pending/20   text-status-pending',
  settled:   'bg-status-completed/20 text-status-completed',
  proposed:  'bg-status-submitted/20 text-status-submitted',
  accepted:  'bg-status-completed/20 text-status-completed',
  declined:  'bg-status-rejected/20  text-status-rejected',
  cancelled: 'bg-status-expired/20   text-status-expired',
};

export default function StatusBadge({ status }: { status: AnyStatus }) {
  const cls = MAP[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize', cls)}>
      {status}
    </span>
  );
}
