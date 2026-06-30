'use client';

import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-xs text-landing-dim">
          &copy; {new Date().getFullYear()} Roomies
        </p>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-xs text-landing-dim transition-colors hover:text-landing-muted">
            Sign in
          </Link>
          <Link href="/register" className="text-xs text-landing-dim transition-colors hover:text-landing-muted">
            Register
          </Link>
        </div>
      </div>
    </footer>
  );
}
