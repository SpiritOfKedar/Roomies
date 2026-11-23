'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { usersApi } from '@/lib/endpoints';
import { SecurityQuestionsForm } from '@/components/SecurityQuestionsForm';
import type { RecoveryStatus } from '@/types';
import { Icon } from '@/components/Icon';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(true);

  const loadRecoveryStatus = useCallback(async () => {
    setRecoveryLoading(true);
    try {
      const { data } = await usersApi.getRecoveryStatus();
      setRecoveryStatus(data.data);
    } catch {
      setRecoveryStatus(null);
    } finally {
      setRecoveryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecoveryStatus();
  }, [loadRecoveryStatus]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#171717]">Profile</h1>
        <p className="text-[#737373] text-sm mt-1">Manage your account</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-5 mb-8">
          <div className="size-16 rounded-full bg-neutral-900 flex items-center justify-center text-2xl font-black text-white shrink-0">
            {initial}
          </div>
          <div>
            <p className="text-xl font-bold text-[#171717]">{user?.name}</p>
            <p className="text-sm text-[#737373]">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-0 divide-y divide-neutral-200">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Icon name="badge" size={18} className="text-[#737373]" />
              <span className="text-sm text-[#737373]">Full Name</span>
            </div>
            <span className="text-sm font-semibold text-[#171717]">{user?.name}</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Icon name="mail" size={18} className="text-[#737373]" />
              <span className="text-sm text-[#737373]">Email</span>
            </div>
            <span className="text-sm font-semibold text-[#171717]">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Icon name="event" size={18} className="text-[#737373]" />
              <span className="text-sm text-[#737373]">Member since</span>
            </div>
            <span className="text-sm font-semibold text-[#171717]">
              {user?.createdAt ? format(new Date(user.createdAt), 'MMMM d, yyyy') : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Icon name="verified_user" size={18} className="text-[#737373]" />
              <span className="text-sm text-[#737373]">Status</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {user?.status ?? 'Active'}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#171717]">Security &amp; Recovery</h3>
            <p className="text-sm text-[#737373] mt-1">
              Set security questions to recover your account if you forget your password.
            </p>
          </div>
          {!recoveryLoading && recoveryStatus && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                recoveryStatus.hasSecurityQuestions
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {recoveryStatus.hasSecurityQuestions ? 'Configured' : 'Not configured'}
            </span>
          )}
        </div>

        {recoveryLoading && (
          <p className="text-sm text-[#737373]">Loading recovery settings…</p>
        )}

        {!recoveryLoading && recoveryStatus && (
          <SecurityQuestionsForm status={recoveryStatus} onSaved={loadRecoveryStatus} />
        )}
      </div>

      <div className="card !border-red-200">
        <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4">Account</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#171717]">Sign out of your account</p>
            <p className="text-xs text-[#737373] mt-0.5">You will need to log in again to access Roomies.</p>
          </div>
          <button onClick={handleLogout} className="btn-danger">
            <Icon name="logout" size={18} />
            Sign Out
          </button>
        </div>
      </div>

      <DeleteAccountSection />
    </div>
  );
}
