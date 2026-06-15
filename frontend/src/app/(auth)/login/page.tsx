'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

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

  return (
    <>
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-24 xl:px-32 bg-white relative overflow-y-auto">
        <div className="w-full max-w-md mx-auto py-10">
          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-3">Welcome Back</h1>
            <p className="text-[#374151] text-lg">Streamline your shared living experience.</p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[#e5e7eb] mb-8">
            <button className="flex-1 pb-3 pt-2 text-center text-[#2563eb] border-b-2 border-[#2563eb] font-bold text-sm tracking-wide">
              Login
            </button>
            <Link
              href="/register"
              className="flex-1 pb-3 pt-2 text-center text-[#374151] hover:text-[#111827] border-b-2 border-transparent hover:border-[#e5e7eb] font-bold text-sm tracking-wide transition-all"
            >
              Sign Up
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Email */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#111827]">Email Address</span>
              <div className="relative group">
                <input
                  className={`w-full h-12 rounded-lg border bg-[#f9fafb] px-4 text-base text-[#111827] placeholder-gray-400 focus:ring-1 focus:bg-white transition-all shadow-sm ${
                    emailError || highlightBothFields
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-[#e5e7eb] focus:border-[#2563eb] focus:ring-[#2563eb]'
                  }`}
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
                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400 group-focus-within:text-[#2563eb] transition-colors select-none pointer-events-none" style={{ fontSize: '20px' }}>mail</span>
              </div>
              {emailError && (
                <p id="email-error" role="alert" className="text-sm text-red-600">
                  {emailError}
                </p>
              )}
            </label>

            {/* Password */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#111827]">Password</span>
              <div className="relative group">
                <input
                  className={`w-full h-12 rounded-lg border bg-[#f9fafb] px-4 text-base text-[#111827] placeholder-gray-400 focus:ring-1 focus:bg-white transition-all shadow-sm ${
                    passwordError || highlightBothFields
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-[#e5e7eb] focus:border-[#2563eb] focus:ring-[#2563eb]'
                  }`}
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
                  className="absolute right-3 top-3 text-gray-400 cursor-pointer hover:text-[#111827] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPw ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              {passwordError && (
                <p id="password-error" role="alert" className="text-sm text-red-600">
                  {passwordError}
                </p>
              )}
              <div className="flex justify-between items-center mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input className="rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]" type="checkbox" />
                  <span className="text-xs font-medium text-[#374151]">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#2563eb] hover:text-blue-700 underline underline-offset-2 transition-all"
                >
                  Forgot password?
                </Link>
              </div>
            </label>

            {/* Submit */}
            <button
              className="mt-2 flex h-12 w-full items-center justify-center rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-base transition-all shadow-sm hover:shadow-md active:scale-[0.99] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#e5e7eb]" />
              <span className="flex-shrink mx-4 text-[#374151] text-xs font-medium uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-[#e5e7eb]" />
            </div>

            {/* Google OAuth */}
            <GoogleSignInButton
              disabled={loading}
              onSuccess={handleGoogleSuccess}
              onError={setError}
            />

            <p className="text-center text-sm text-[#374151] mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-[#2563eb] hover:text-blue-700 hover:underline">Sign up for free</Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right: Decorative panel */}
      <div className="hidden lg:flex w-1/2 relative bg-[#f9fafb] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/90 via-transparent to-transparent" />
        </div>
        <div className="relative z-10 mt-auto p-16 w-full text-white">
          <div className="bg-[#111827]/60 backdrop-blur-md rounded-xl p-8 border border-white/10 shadow-2xl max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(22,163,74,0.6)]" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/90">Customer Success</span>
            </div>
            <h3 className="text-2xl font-bold leading-snug mb-4">
              &ldquo;Roomies transformed how we handle bills. No more awkward conversations at the end of the month.&rdquo;
            </h3>
            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/10">
              <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center ring-2 ring-white/20 text-lg font-bold">
                S
              </div>
              <div>
                <p className="font-bold text-sm text-white">Sarah Jenkins</p>
                <p className="text-xs text-white/70 font-medium">San Francisco, CA</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
