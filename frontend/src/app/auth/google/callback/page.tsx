'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/endpoints';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');

    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      return;
    }

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Google sign-in did not return session tokens');
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    authApi
      .me()
      .then(() => router.replace('/dashboard'))
      .catch(() => {
        localStorage.clear();
        setError('Signed in with Google but failed to load your profile');
      });
  }, [router]);

  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="mb-2 text-lg font-bold text-[#111827]">Google sign-in failed</p>
            <p className="mb-6 text-sm text-red-600">{error}</p>
            <Link href="/login" className="font-semibold text-[#2563eb] hover:underline">
              Back to login
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-[#111827]">Completing Google sign-in…</p>
            <p className="mt-2 text-sm text-[#374151]">Please wait while we finish setting up your session.</p>
          </>
        )}
      </div>
    </div>
  );
}
