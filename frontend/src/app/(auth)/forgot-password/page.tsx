'use client';
import AuthShowcase from '@/components/AuthShowcase';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recoveryApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import type { RecoveryMethod, RecoveryOptions } from '@/types';

type Step = 'email' | 'method' | 'questions' | 'email-sent';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [options, setOptions] = useState<RecoveryOptions | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await recoveryApi.options(email);
      const opts = data.data;
      setOptions(opts);

      if (opts.methods.length === 0) {
        setError(
          'No recovery options are available for this email. If you use Google sign-in only, try that instead.',
        );
        return;
      }

      if (opts.methods.length === 1) {
        const only = opts.methods[0];
        if (only === 'email') {
          await recoveryApi.sendEmail(email);
          setStep('email-sent');
        } else {
          setStep('questions');
        }
        return;
      }

      setStep('method');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async (method: RecoveryMethod) => {
    setLoading(true);
    setError(null);
    try {
      if (method === 'email') {
        await recoveryApi.sendEmail(email);
        setStep('email-sent');
      } else {
        setStep('questions');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!options?.questions.length) return;

    setLoading(true);
    setError(null);
    try {
      const payload = options.questions.map((q) => ({
        questionId: q.questionId,
        answer: answers[q.questionId] ?? '',
      }));
      const { data } = await recoveryApi.verifyQuestions(email, payload);
      const token = data.data.recoveryToken;
      router.push(`/reset-password?token=${encodeURIComponent(token)}&type=recovery`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Incorrect answers. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 md:px-24 xl:px-32 relative overflow-y-auto">
        <div className="w-full max-w-md mx-auto py-10">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#171717] mb-3">Forgot password</h1>
            <p className="text-[#525252] text-lg">
              {step === 'email' && 'Enter your email to see recovery options.'}
              {step === 'method' && 'Choose how you would like to recover your account.'}
              {step === 'questions' && 'Answer your security questions to continue.'}
              {step === 'email-sent' && 'Check your inbox for a reset link.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#171717]">Email address</span>
                <input
                  className="w-full h-12 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base text-[#171717] focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#171717] hover:bg-[#262626] text-white font-semibold shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-all disabled:opacity-60"
              >
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'method' && options && (
            <div className="flex flex-col gap-4">
              {options.methods.includes('email') && (
                <button
                  type="button"
                  onClick={() => handleMethodSelect('email')}
                  disabled={loading}
                  className="rounded-xl border border-[#E5E5E5] p-5 text-left hover:border-[#171717] hover:bg-neutral-50 transition-all disabled:opacity-60"
                >
                  <p className="font-bold text-[#171717]">Email me a reset link</p>
                  <p className="text-sm text-[#525252] mt-1">We will send a link to {email}</p>
                </button>
              )}
              {options.methods.includes('security_questions') && (
                <button
                  type="button"
                  onClick={() => handleMethodSelect('security_questions')}
                  disabled={loading}
                  className="rounded-xl border border-[#E5E5E5] p-5 text-left hover:border-[#171717] hover:bg-neutral-50 transition-all disabled:opacity-60"
                >
                  <p className="font-bold text-[#171717]">Answer security questions</p>
                  <p className="text-sm text-[#525252] mt-1">Use the questions you set up in your account</p>
                </button>
              )}
            </div>
          )}

          {step === 'questions' && options && (
            <form onSubmit={handleQuestionsSubmit} className="flex flex-col gap-5">
              {options.questions.map((q) => (
                <label key={q.questionId} className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-[#171717]">{q.text}</span>
                  <input
                    className="h-12 rounded-lg border border-[#E5E5E5] bg-white px-4 text-base focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
                    type="text"
                    value={answers[q.questionId] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.questionId]: e.target.value }))
                    }
                    required
                    minLength={3}
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#171717] hover:bg-[#262626] text-white font-semibold shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-all disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify answers'}
              </button>
            </form>
          )}

          {step === 'email-sent' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-4 text-sm text-[#525252]">
                If an account exists for <strong>{email}</strong>, we sent a password reset link.
                The link expires in 1 hour.
              </div>
              <p className="text-sm text-[#525252]">
                Did not receive it? Check spam or try security questions if you configured them.
              </p>
            </div>
          )}

          <p className="text-center text-sm text-[#525252] mt-8">
            <Link href="/login" className="font-bold text-[#171717] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>

      <AuthShowcase title="Back into your house in a minute" line="Reset with the email link, or the security questions you set in your profile." />
    </>
  );
}
