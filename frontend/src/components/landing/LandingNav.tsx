'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { SpecularGetStarted } from './ui/SpecularGetStarted';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#showcase', label: 'Showcase' },
];

export function LandingNav() {
  const { user, loading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-landing-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-bold tracking-tight text-landing-fg uppercase">
          Roomies
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-landing-muted transition-colors hover:text-landing-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-full bg-landing-fg px-4 text-xs font-semibold text-landing-bg transition-colors hover:bg-white"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline text-sm text-landing-muted transition-colors hover:text-landing-fg"
              >
                Sign in
              </Link>
              <SpecularGetStarted size="sm" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
