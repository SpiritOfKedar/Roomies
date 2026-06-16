'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/Icon';

const navItems = [
  { label: 'My Houses', href: '/dashboard', icon: 'dashboard' },
  { label: 'My Tasks',  href: '/tasks',     icon: 'check_circle' },
  { label: 'Expenses',  href: '/expenses',  icon: 'payments' },
  { label: 'Community', href: '/community', icon: 'group' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 bg-white border-r border-[#E5E5E5] hidden md:flex flex-col h-screen fixed left-0 top-0 z-50">
        {/* Logo */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-sm shrink-0">
              <Icon name="roofing" size={22} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#171717]">Roomies</h1>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1">
            {navItems.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-neutral-100 text-black font-semibold'
                      : 'text-[#737373] hover:bg-neutral-50 hover:text-[#171717]'
                  }`}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom */}
        <div className="mt-auto p-6 border-t border-[#E5E5E5]">
          <nav className="flex flex-col gap-1 mb-4">
            <Link
              href="/profile"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/profile'
                  ? 'bg-neutral-100 text-black font-semibold'
                  : 'text-[#737373] hover:bg-neutral-50 hover:text-[#171717]'
              }`}
            >
              <Icon name="settings" size={20} />
              Settings
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#737373] hover:bg-neutral-50 hover:text-red-600 text-sm font-medium transition-colors w-full text-left"
            >
              <Icon name="logout" size={20} />
              Log Out
            </button>
          </nav>

          {/* User avatar row */}
          <Link href="/profile" className="flex items-center gap-3 p-2 rounded-xl border border-transparent hover:border-[#E5E5E5] hover:bg-neutral-50 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-bold text-[#171717] shrink-0">
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-[#171717] truncate">{user?.name ?? 'Guest'}</p>
              <p className="text-xs text-[#737373] truncate">{user?.email ?? ''}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5] flex items-center justify-around px-2 py-1 safe-area-bottom">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg text-[10px] font-bold transition-colors ${
                active ? 'text-[#171717]' : 'text-[#737373]'
              }`}
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            pathname === '/profile' ? 'text-[#171717]' : 'text-[#737373]'
          }`}
        >
          <Icon name="person" size={22} />
          Profile
        </Link>
      </nav>
    </>
  );
}

