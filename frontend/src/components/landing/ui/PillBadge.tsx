'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

type PillBadgeProps = {
  href: string;
  label: string;
};

export function PillBadge({ href, label }: PillBadgeProps) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-landing-muted transition-colors hover:bg-white/[0.06] hover:text-landing-fg"
    >
      <Sparkles className="h-3.5 w-3.5 text-landing-fg" />
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
