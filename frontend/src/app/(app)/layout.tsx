'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';
import Loader from '@/components/ui/Loader';

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
    return <Loader fullscreen size={80} label="Signing you in" />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="md:ml-64 p-6 md:p-12 pb-28 md:pb-12 min-h-screen max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
