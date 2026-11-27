'use client';
import AuthShowcase from '@/components/AuthShowcase';

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
    `w-full h-12 rounded-lg border bg-white px-4 text-base text-[#171717] placeholder-[#a3a3a3] focus:ring-1 focus:bg-white transition-all ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
        : 'border-[#E5E5E5] focus:border-[#171717] focus:ring-[#171717]'
    }`;

  return (
    <>
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-[#171717] mb-2">Welcome back</h1>
            <p className="text-[#737373]">Sign in to your Roomies account.</p>
          </div>

          <div className="mb-8 flex rounded-full border border-[#E5E5E5] bg-white p-1 shadow-sm">
            <span className="flex-1 rounded-full bg-[#171717] py-2 text-center text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgb(0_0_0/0.35)]">
              Login
            </span>
            <Link
              href="/register"
              className="flex-1 rounded-full py-2 text-center text-sm font-semibold text-[#737373] transition-colors hover:text-[#171717]"
            >
              Sign up
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#171717]">Email</span>
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
                <Icon name="mail" size={20} className="absolute right-3 top-3 text-[#a3a3a3] group-focus-within:text-[#737373] transition-colors pointer-events-none" />
              </div>
              {emailError && (
                <p id="email-error" role="alert" className="text-sm text-red-600">
                  {emailError}
                </p>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#171717]">Password</span>
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
                  className="absolute right-3 top-3 text-[#a3a3a3] hover:text-[#171717] transition-colors"
                >
                  <Icon name={showPw ? 'visibility' : 'visibility_off'} size={20} />
                </button>
              </div>
              {passwordError && (
                <p id="password-error" role="alert" className="text-sm text-red-600">
                  {passwordError}
                </p>
              )}
              <div className="flex justify-between items-center mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input className="rounded border-neutral-300 bg-white text-[#171717] focus:ring-[#171717]" type="checkbox" />
                  <span className="text-xs text-[#737373]">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </label>

            <button
              className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-[#171717] text-white font-semibold text-sm shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-all hover:-translate-y-px hover:bg-[#262626] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
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
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-[#171717] hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>

      <AuthShowcase title="Your house is where you left it" line="Turns, votes and bills pick up right where your roommates left them." />
    </>
  );
}
