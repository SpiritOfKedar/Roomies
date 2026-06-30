'use client';

import Link from 'next/link';
import clsx from 'clsx';

type GlowButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

export function GlowButton({ href, children, variant = 'primary' }: GlowButtonProps) {
  return (
    <Link
      href={href}
      className={clsx(
        'relative inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium transition-all',
        variant === 'primary'
          ? 'bg-landing-fg text-landing-bg hover:bg-white shadow-[0_0_24px_rgba(255,255,255,0.15)]'
          : 'border border-white/15 bg-white/[0.03] text-landing-fg hover:bg-white/[0.08] hover:border-white/25',
      )}
    >
      {children}
    </Link>
  );
}
