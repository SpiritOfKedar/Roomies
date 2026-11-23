'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usersApi } from '@/lib/endpoints';
import { Icon } from '@/components/Icon';
import DodgeField from '@/components/ui/reactbits/DodgeField';

const TAUNTS = ['Delete my account', 'Nope', 'Too slow', 'Reconsidering?', 'Fine. Take it.'];

function label(dodges: number, gave: boolean, busy: boolean) {
  if (busy) return 'Deleting…';
  if (gave) return TAUNTS[4];
  return TAUNTS[Math.min(dodges, 3)];
}

export function DeleteAccountSection() {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setError('');
  };

  const doDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await usersApi.deleteAccount(password || undefined);
      await logout();
      router.push('/login');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Could not delete your account.');
      setBusy(false);
    }
  };

  return (
    <div className="card !border-red-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#171717]">Delete your account</p>
          <p className="text-xs text-[#737373] mt-0.5">
            Permanently removes your access. This can&apos;t be undone.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-danger shrink-0">
          <Icon name="delete" size={18} />
          Delete account
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#171717]">Leaving so soon?</h3>
            <p className="text-sm text-[#737373] mt-1">
              Enter your password if you have one, then catch the button below. It&apos;s shy, but it
              gives in eventually.
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (if set)"
              className="input mt-4 w-full"
              autoComplete="current-password"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <DodgeField
              inkColor="#171717"
              contrastColor="#ffffff"
              fieldHeight={220}
              patience={3}
              reach={80}
              notice="On touch screens it won't run away — tap to delete."
              disabled={busy}
              className="mt-2"
            >
              {({ dodges, gave }) => (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (gave || window.matchMedia('(hover: none)').matches) doDelete();
                  }}
                  className="btn-danger"
                >
                  {label(dodges, gave, busy)}
                </button>
              )}
            </DodgeField>

            <div className="flex justify-end">
              <button onClick={close} className="btn-secondary" disabled={busy}>
                Keep my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
