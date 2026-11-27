export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-[#171717]">
      <header className="px-4 pt-4">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full border border-[#E5E5E5] bg-white/80 pl-2 pr-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.18)] backdrop-blur-xl">
          {/* plain links: the landing page is a static document, so leave the app for it */}
          <a href="/" className="group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-[17px] font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-[#171717] text-white shadow-[0_6px_14px_-6px_rgb(0_0_0/0.55)] transition-transform duration-500 group-hover:-rotate-6">
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
              </svg>
            </span>
            Roomies
          </a>
          <a
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-[#525252] transition-colors hover:bg-black/[0.04] hover:text-[#171717]"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
            Back to home
          </a>
        </div>
      </header>
      <main className="flex flex-1 flex-col lg:flex-row">{children}</main>
    </div>
  );
}
