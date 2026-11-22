'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/Icon';
import { RailToc, type RailTocItem } from '@/components/ui/rare/rail-toc';
import { housesApi } from '@/lib/endpoints';

const navItems = [
  { label: 'My Houses', href: '/dashboard', icon: 'dashboard' },
  { label: 'My Tasks',  href: '/tasks',     icon: 'check_circle' },
  { label: 'Expenses',  href: '/expenses',  icon: 'payments' },
  { label: 'Community', href: '/community', icon: 'group' },
];

/** Houses listed under "My Houses" in the rail; more than this and the list links to the dashboard. */
const MAX_RAIL_HOUSES = 5;

/**
 * Rail items: the main sections, with your houses nested under "My Houses"
 * (one indent level, which is what gives the rail its bends).
 */
function buildRail(houses: { id: string; name: string }[]): RailTocItem[] {
  const [home, ...rest] = navItems;
  return [
    { id: home.href, label: home.label, href: home.href },
    ...houses.slice(0, MAX_RAIL_HOUSES).map((h) => ({
      id: `house-${h.id}`,
      label: h.name,
      href: `/houses/${h.id}`,
      depth: 1,
    })),
    ...rest.map((item) => ({ id: item.href, label: item.label, href: item.href })),
  ];
}

/** The rail item for this route, or -1 for pages that aren't in the menu (e.g. Settings). */
function activeRailIndex(items: RailTocItem[], pathname: string): number {
  // Deepest match wins, so /houses/abc/chores/xyz highlights house "abc".
  let best = -1;
  let bestLength = 0;
  items.forEach((item, i) => {
    const href = item.href ?? '';
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > bestLength) {
      best = i;
      bestLength = href.length;
    }
  });
  // A house that isn't listed in the rail still belongs under "My Houses".
  if (best === -1 && pathname.startsWith('/houses/')) return 0;
  return best;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  // Same query as the My Tasks page, so the list is shared from cache.
  const { data: houses = [] } = useQuery({
    queryKey: ['houses'],
    queryFn: async () => (await housesApi.list()).data.data ?? [],
    enabled: !!user,
  });
  const railItems = useMemo(() => buildRail(houses), [houses]);
  const activeRail = activeRailIndex(railItems, pathname);

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

          {/* Nav — Rare UI rail: the plane flies to the page you're on */}
          <RailToc
            title="Menu"
            className="w-full pl-1 text-[15px] [&_[data-slot=rail-toc-list]_a]:truncate [&_[data-slot=rail-toc-list]_a]:py-2"
            indent={18}
            items={railItems}
            activeIndex={activeRail}
          />
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

