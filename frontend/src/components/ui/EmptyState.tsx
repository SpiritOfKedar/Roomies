'use client';

import type { ReactNode } from 'react';
import { Folder } from '@/components/ui/rare/folder-component';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Empty list / caught-up state, illustrated with Rare UI's folder (hover to peek inside). */
export default function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="h-[190px] w-[230px]">
        <Folder color="black" size="sm" aria-hidden />
      </div>
      <p className="mt-2 text-lg font-semibold text-neutral-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
