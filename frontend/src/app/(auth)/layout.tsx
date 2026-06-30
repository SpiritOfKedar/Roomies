import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-landing-bg text-landing-fg overflow-hidden">
      <header className="border-b border-white/[0.06] bg-landing-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold tracking-tight uppercase">
            Roomies
          </Link>
          <Link
            href="/"
            className="text-sm text-landing-muted transition-colors hover:text-landing-fg"
          >
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col lg:flex-row">
        {children}
      </main>
    </div>
  );
}
