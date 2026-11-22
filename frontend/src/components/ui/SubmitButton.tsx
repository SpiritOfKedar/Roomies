'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import StatusMark from '@/components/ui/reactbits/status-mark';
import type { ActionStatus } from '@/hooks/useActionStatus';
import { cn } from '@/lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  status: ActionStatus;
  children: ReactNode;
  /** Text shown next to the status mark while working / after success / on failure */
  labels?: { running?: string; done?: string; failed?: string };
  /** Light buttons need a dark mark; dark buttons (default) a light one */
  tone?: 'dark' | 'light';
}

const MARK: Record<Exclude<ActionStatus, 'idle'>, 'running' | 'done' | 'failed'> = {
  running: 'running',
  done: 'done',
  failed: 'failed',
};

/**
 * A button that turns into a React Bits status mark while its action runs:
 * spinning ring → drawn tick on success, cross on failure.
 */
export default function SubmitButton({
  status,
  children,
  labels,
  tone = 'dark',
  className,
  disabled,
  type = 'submit',
  ...props
}: Props) {
  const working = status === 'running' || status === 'done';
  return (
    <button
      type={type}
      disabled={disabled || working}
      aria-busy={status === 'running' || undefined}
      className={cn(tone === 'dark' ? 'btn-primary' : 'btn-secondary', 'disabled:opacity-100', disabled && !working && 'opacity-50', className)}
      {...props}
    >
      {status === 'idle' ? (
        children
      ) : (
        <StatusMark
          status={MARK[status]}
          label={
            status === 'running'
              ? labels?.running ?? 'Working…'
              : status === 'done'
                ? labels?.done ?? 'Done'
                : labels?.failed ?? 'Failed'
          }
          color="currentColor"
          doneColor={tone === 'dark' ? '#4ade80' : '#16a34a'}
          errorColor={tone === 'dark' ? '#f87171' : '#dc2626'}
          size={18}
          fontSize={14}
          strike={false}
        />
      )}
    </button>
  );
}
