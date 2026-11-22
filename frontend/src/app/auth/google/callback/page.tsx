'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/endpoints';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // The sign-in code is single-use; StrictMode's double effect must not spend it twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');

    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      return;
    }

    const code = params.get('code');

    if (!code) {
      setError('Google sign-in did not return a sign-in code');
      return;
    }

    // Drop the one-time code from the address bar and history right away.
    window.history.replaceState(null, '', window.location.pathname);

    authApi
      .googleExchange(code)
      .then(({ data }) => {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        return authApi.me();
      })
      .then(() => router.replace('/dashboard'))
      .catch(() => {
        localStorage.clear();
        setError('Google sign-in expired or failed. Please try again.');
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
