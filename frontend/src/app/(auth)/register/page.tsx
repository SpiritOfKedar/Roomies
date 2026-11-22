'use client';

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
    'w-full h-12 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-base text-landing-fg placeholder-landing-dim focus:border-white/30 focus:ring-1 focus:ring-white/10 focus:bg-white/[0.05] transition-all';

  return (
    <>
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-landing-fg mb-2">Create account</h1>
            <p className="text-landing-muted">Start managing your shared living today.</p>
          </div>

          <div className="flex border-b border-white/10 mb-8">
            <Link
              href="/login"
              className="flex-1 pb-3 text-center text-sm font-semibold text-landing-muted hover:text-landing-fg border-b-2 border-transparent transition-colors"
            >
              Login
            </Link>
            <span className="flex-1 pb-3 text-center text-sm font-semibold text-landing-fg border-b-2 border-landing-fg">
              Sign up
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-landing-fg">Full name</span>
              <div className="relative group">
                <input
                  className={inputClass}
                  placeholder="Jane Smith"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Icon name="person" size={20} className="absolute right-3 top-3 text-landing-dim group-focus-within:text-landing-muted transition-colors pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-landing-fg">Email</span>
              <div className="relative group">
                <input
                  className={inputClass}
                  placeholder="name@domain.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Icon name="mail" size={20} className="absolute right-3 top-3 text-landing-dim group-focus-within:text-landing-muted transition-colors pointer-events-none" />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-landing-fg">Password</span>
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
                  className="absolute right-3 top-3 text-landing-dim hover:text-landing-fg transition-colors"
                >
                  <Icon name={showPw ? 'visibility' : 'visibility_off'} size={20} />
                </button>
              </div>
            </label>

            <button
              className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-landing-fg text-landing-bg font-semibold text-sm transition-all hover:bg-white disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-white/10" />
              <span className="shrink mx-4 text-landing-dim text-xs uppercase tracking-wider">Or</span>
              <div className="grow border-t border-white/10" />
            </div>

            <GoogleSignInButton
              disabled={loading}
              onSuccess={handleGoogleSuccess}
              onError={setError}
            />

            <p className="text-center text-sm text-landing-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-landing-fg hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 items-center justify-center border-l border-white/[0.06] p-16">
        <blockquote className="max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-landing-dim mb-6">
            Why Roomies?
          </p>
          <p className="text-2xl font-bold leading-snug text-landing-fg">
            &ldquo;Track tasks, split expenses, keep the peace, all in one place.&rdquo;
          </p>
          <footer className="mt-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold ring-2 ring-white/10">
              R
            </div>
            <div>
              <p className="font-semibold text-sm text-landing-fg">Built for roommates</p>
              <p className="text-xs text-landing-muted">Join thousands of happy homes</p>
            </div>
          </footer>
        </blockquote>
      </div>
    </>
  );
}
