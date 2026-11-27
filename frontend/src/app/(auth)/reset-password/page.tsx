'use client';
import AuthShowcase from '@/components/AuthShowcase';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { recoveryApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import type { RecoveryTokenType } from '@/types';
import { Icon } from '@/components/Icon';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const type = (searchParams.get('type') ?? 'email') as RecoveryTokenType;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token || (type !== 'email' && type !== 'recovery')) {
      setVerifying(false);
      setTokenValid(false);
      return;
    }

    recoveryApi
      .verifyToken(token, type)
      .then(() => {
        setTokenValid(true);
      })
      .catch(() => {
        setTokenValid(false);
      })
      .finally(() => setVerifying(false));
  }, [token, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await recoveryApi.resetPassword(token, type, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-24 xl:px-32 relative overflow-y-auto">
        <div className="w-full max-w-md mx-auto py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#171717] mb-3">Reset password</h1>
            <p className="text-[#525252] text-lg">Choose a new password for your account.</p>
          </div>

          {verifying && (
            <p className="text-sm text-[#525252]">Verifying reset link…</p>
          )}

          {!verifying && !tokenValid && (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                This reset link is invalid or has expired.
              </div>
              <Link href="/forgot-password" className="font-bold text-[#171717] hover:underline text-sm">
                Request a new reset link
              </Link>
            </div>
          )}

          {!verifying && tokenValid && !success && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#171717]">New password</span>
                <div className="relative">
                  <input
                    className="w-full h-12 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-[#171717]"
                  >
                    <Icon name={showPw ? 'visibility' : 'visibility_off'} size={20} />
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#171717]">Confirm password</span>
                <input
                  className="w-full h-12 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#171717] hover:bg-[#262626] text-white font-semibold shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-all disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              Password updated. Redirecting to login…
            </div>
          )}

          <p className="text-center text-sm text-[#525252] mt-8">
            <Link href="/login" className="font-bold text-[#171717] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>

      <AuthShowcase title="Pick a new password" line="Then sign in, and your house's chores are right where they were." />
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[#525252]">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
