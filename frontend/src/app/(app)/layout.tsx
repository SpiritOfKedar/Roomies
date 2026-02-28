'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isHousePage = /^\/houses\/[^/]+/.test(pathname);

  useEffect(() => {
    if (!SKIP_AUTH && !loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (!SKIP_AUTH && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* House detail pages get their own full-screen dark layout */
  if (isHousePage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="md:ml-64 p-6 md:p-12 pb-24 md:pb-12 min-h-screen max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
