'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [highlightBothFields, setHighlightBothFields] = useState(false);

  const clearFieldErrors = () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setHighlightBothFields(false);
  };

  const setLoginError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('email and password')) {
      setError(message);
      setHighlightBothFields(true);
      setEmailError(null);
      setPasswordError(null);
    } else if (lower.includes('password')) {
      setPasswordError(message);
      setEmailError(null);
      setError(null);
      setHighlightBothFields(false);
    } else if (lower.includes('email')) {
      setEmailError(message);
      setPasswordError(null);
      setError(null);
      setHighlightBothFields(false);
    } else {
      setError(message);
      setEmailError(null);
      setPasswordError(null);
      setHighlightBothFields(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearFieldErrors();
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setLoginError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setLoading(true);
    clearFieldErrors();
    try {
      await loginWithGoogle(idToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setLoginError(getApiErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full h-12 rounded-lg border bg-white/[0.03] px-4 text-base text-landing-fg placeholder-landing-dim focus:ring-1 focus:bg-white/[0.05] transition-all ${
      hasError
        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
        : 'border-white/10 focus:border-white/30 focus:ring-white/10'
    }`;

  return (
    <>
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-landing-fg mb-2">Welcome back</h1>
            <p className="text-landing-muted">Sign in to your Roomies account.</p>
          </div>

          <div className="flex border-b border-white/10 mb-8">
            <span className="flex-1 pb-3 text-center text-sm font-semibold text-landing-fg border-b-2 border-landing-fg">
              Login
            </span>
            <Link
              href="/register"
              className="flex-1 pb-3 text-center text-sm font-semibold text-landing-muted hover:text-landing-fg border-b-2 border-transparent transition-colors"
            >
              Sign up
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-landing-fg">Email</span>
              <div className="relative group">
                <input
                  className={inputClass(!!(emailError || highlightBothFields))}
                  placeholder="name@domain.com"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error || emailError || passwordError || highlightBothFields) clearFieldErrors();
                  }}
                  required
                  aria-invalid={emailError || highlightBothFields ? true : undefined}
                  aria-describedby={emailError ? 'email-error' : error && highlightBothFields ? 'login-error' : undefined}
                />
                <Icon name="mail" size={20} className="absolute right-3 top-3 text-landing-dim group-focus-within:text-landing-muted transition-colors pointer-events-none" />
              </div>
              {emailError && (
                <p id="email-error" role="alert" className="text-sm text-red-400">
                  {emailError}
                </p>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-landing-fg">Password</span>
              <div className="relative group">
                <input
                  className={inputClass(!!(passwordError || highlightBothFields))}
                  placeholder="Enter your password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error || emailError || passwordError || highlightBothFields) clearFieldErrors();
                  }}
                  required
                  aria-invalid={passwordError || highlightBothFields ? true : undefined}
                  aria-describedby={passwordError ? 'password-error' : error && highlightBothFields ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-landing-dim hover:text-landing-fg transition-colors"
                >
                  <Icon name={showPw ? 'visibility' : 'visibility_off'} size={20} />
                </button>
              </div>
              {passwordError && (
                <p id="password-error" role="alert" className="text-sm text-red-400">
                  {passwordError}
                </p>
              )}
              <div className="flex justify-between items-center mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input className="rounded border-white/20 bg-white/5 text-landing-fg focus:ring-white/20" type="checkbox" />
                  <span className="text-xs text-landing-muted">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-landing-muted hover:text-landing-fg transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </label>

            <button
              className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-landing-fg text-landing-bg font-semibold text-sm transition-all hover:bg-white disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
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
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-landing-fg hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 items-center justify-center border-l border-white/[0.06] p-16">
        <blockquote className="max-w-lg">
          <p className="text-2xl font-bold leading-snug text-landing-fg">
            &ldquo;Roomies transformed how we handle bills. No more awkward conversations at the end of the month.&rdquo;
          </p>
          <footer className="mt-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold ring-2 ring-white/10">
              S
            </div>
            <div>
              <p className="font-semibold text-sm text-landing-fg">Sarah Jenkins</p>
              <p className="text-xs text-landing-muted">San Francisco, CA</p>
            </div>
          </footer>
        </blockquote>
      </div>
    </>
  );
}
