'use client';
import AuthShowcase from '@/components/AuthShowcase';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Icon } from '@/components/Icon';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(name, email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle(idToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full h-12 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base text-[#171717] placeholder-[#a3a3a3] focus:border-[#171717] focus:ring-1 focus:ring-[#171717] focus:bg-white transition-all';

  return (
    <>
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-[#171717] mb-2">Create account</h1>
            <p className="text-[#737373]">Start managing your shared living today.</p>
          </div>

          <div className="mb-8 flex rounded-full border border-[#E5E5E5] bg-white p-1 shadow-sm">
            <Link
              href="/login"
              className="flex-1 rounded-full py-2 text-center text-sm font-semibold text-[#737373] transition-colors hover:text-[#171717]"
            >
              Login
            </Link>
            <span className="flex-1 rounded-full bg-[#171717] py-2 text-center text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgb(0_0_0/0.35)]">
              Sign up
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#171717]">Full name</span>
              <div className="relative group">
                <input
                  className={inputClass}
                  placeholder="Jane Smith"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Icon name="person" size={20} className="absolute right-3 top-3 text-[#a3a3a3] group-focus-within:text-[#737373] transition-colors pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#171717]">Email</span>
              <div className="relative group">
                <input
                  className={inputClass}
                  placeholder="name@domain.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Icon name="mail" size={20} className="absolute right-3 top-3 text-[#a3a3a3] group-focus-within:text-[#737373] transition-colors pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#171717]">Password</span>
              <div className="relative group">
                <input
                  className={inputClass}
                  placeholder="Min 8 characters"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-[#a3a3a3] hover:text-[#171717] transition-colors"
                >
                  <Icon name={showPw ? 'visibility' : 'visibility_off'} size={20} />
                </button>
              </div>
            </label>

            <button
              className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-[#171717] text-white font-semibold text-sm shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-all hover:-translate-y-px hover:bg-[#262626] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-[#E5E5E5]" />
              <span className="shrink mx-4 text-[#a3a3a3] text-xs uppercase tracking-wider">Or</span>
              <div className="grow border-t border-[#E5E5E5]" />
            </div>

            <GoogleSignInButton
              disabled={loading}
              onSuccess={handleGoogleSuccess}
              onError={setError}
            />

            <p className="text-center text-sm text-[#737373]">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-[#171717] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>

      <AuthShowcase title="Fair turns from the first chore" line="Start a house, share the invite code, and Roomies picks whose turn it is." />
    </>
  );
}
