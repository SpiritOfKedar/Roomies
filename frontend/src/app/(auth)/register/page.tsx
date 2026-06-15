'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

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

  return (
    <>
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-24 xl:px-32 bg-white relative overflow-y-auto">
        <div className="w-full max-w-md mx-auto py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-3">Create Account</h1>
            <p className="text-[#374151] text-lg">Start managing your shared living today.</p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[#e5e7eb] mb-8">
            <Link
              href="/login"
              className="flex-1 pb-3 pt-2 text-center text-[#374151] hover:text-[#111827] border-b-2 border-transparent hover:border-[#e5e7eb] font-bold text-sm tracking-wide transition-all"
            >
              Login
            </Link>
            <button className="flex-1 pb-3 pt-2 text-center text-[#2563eb] border-b-2 border-[#2563eb] font-bold text-sm tracking-wide">
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Name */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#111827]">Full Name</span>
              <div className="relative group">
                <input
                  className="w-full h-12 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 text-base text-[#111827] placeholder-gray-400 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] focus:bg-white transition-all shadow-sm"
                  placeholder="Jane Smith"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400 group-focus-within:text-[#2563eb] transition-colors select-none pointer-events-none" style={{ fontSize: '20px' }}>person</span>
              </div>
            </label>

            {/* Email */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#111827]">Email Address</span>
              <div className="relative group">
                <input
                  className="w-full h-12 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 text-base text-[#111827] placeholder-gray-400 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] focus:bg-white transition-all shadow-sm"
                  placeholder="name@domain.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400 group-focus-within:text-[#2563eb] transition-colors select-none pointer-events-none" style={{ fontSize: '20px' }}>mail</span>
              </div>
            </label>

            {/* Password */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#111827]">Password</span>
              <div className="relative group">
                <input
                  className="w-full h-12 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 text-base text-[#111827] placeholder-gray-400 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] focus:bg-white transition-all shadow-sm"
                  placeholder="Min 8 characters"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-gray-400 cursor-pointer hover:text-[#111827] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPw ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
            </label>

            <button
              className="mt-2 flex h-12 w-full items-center justify-center rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-base transition-all shadow-sm hover:shadow-md active:scale-[0.99] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#e5e7eb]" />
              <span className="flex-shrink mx-4 text-[#374151] text-xs font-medium uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-[#e5e7eb]" />
            </div>

            {/* SSO */}
            <GoogleSignInButton
              disabled={loading}
              onSuccess={handleGoogleSuccess}
              onError={setError}
            />

            <p className="text-center text-sm text-[#374151] mt-6">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-[#2563eb] hover:text-blue-700 hover:underline">Sign in</Link>
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
              <span className="text-xs font-bold uppercase tracking-widest text-white/90">Why Roomies?</span>
            </div>
            <h3 className="text-2xl font-bold leading-snug mb-4">
              &ldquo;Track tasks, split expenses, keep the peace — all in one place.&rdquo;
            </h3>
            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/10">
              <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center ring-2 ring-white/20 text-lg font-bold">
                R
              </div>
              <div>
                <p className="font-bold text-sm text-white">Built for Roommates</p>
                <p className="text-xs text-white/70 font-medium">Join thousands of happy homes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
