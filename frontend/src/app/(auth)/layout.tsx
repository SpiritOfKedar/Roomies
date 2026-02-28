export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f9fafb] overflow-hidden relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between border-b border-[#e5e7eb] bg-white/90 backdrop-blur-sm px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-[#2563eb]">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#111827]">Roomies</h2>
        </div>
        <div className="hidden sm:flex gap-6">
          <a className="text-sm font-medium text-[#374151] hover:text-[#2563eb] transition-colors" href="#">Help Center</a>
          <a className="text-sm font-medium text-[#374151] hover:text-[#2563eb] transition-colors" href="#">Privacy Policy</a>
        </div>
      </header>
      {/* Main content */}
      <main className="flex flex-1 h-screen pt-[72px]">
        {children}
      </main>
    </div>
  );
}

