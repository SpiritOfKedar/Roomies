'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
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

const mobileItems = [
  { label: 'Houses', href: '/dashboard', icon: 'dashboard' },
  { label: 'Tasks', href: '/tasks', icon: 'check_circle' },
  { label: 'Expenses', href: '/expenses', icon: 'payments' },
  { label: 'Community', href: '/community', icon: 'group' },
  { label: 'Profile', href: '/profile', icon: 'person' },
];

/** House pages count as "Houses" so the dock never sits with nothing selected. */
function isMobileActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/houses');
  return pathname === href || pathname.startsWith(`${href}/`);
}

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

      {/* Mobile: floating glass dock. Icons only; the active item grows into a labelled pill. */}
      <nav
        aria-label="Main"
        className="md:hidden fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/75 p-1.5 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150">
          {mobileItems.map((item) => {
            const active = isMobileActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  active ? 'px-4 text-white' : 'w-11 text-[#737373] active:text-[#171717]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-dock-pill"
                    className="absolute inset-0 rounded-full bg-[#171717]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon name={item.icon} size={20} />
                  {active && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.05 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

