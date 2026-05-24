'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { housesApi } from '@/lib/endpoints';
import type { House, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TasksTab from './components/TasksTab';
import ExpensesTab from './components/ExpensesTab';
import LeaderboardTab from './components/LeaderboardTab';
import SwapsTab from './components/SwapsTab';
import ChatTab from './components/ChatTab';
import PenaltiesSection from './components/PenaltiesSection';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';

type Tab = 'tasks' | 'expenses' | 'leaderboard' | 'swaps' | 'chat' | 'penalties';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'tasks', label: 'Tasks', icon: 'check_circle' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'expenses', label: 'Expenses', icon: 'payments' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { id: 'swaps', label: 'Swaps', icon: 'swap_horiz' },
  { id: 'penalties', label: 'Penalties', icon: 'gavel' },
];

export default function HousePage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('tasks');

  // Add Member Modal State
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Manage roommate state
  const [manageRoommateId, setManageRoommateId] = useState<string | null>(null);
  const [managingRoommate, setManagingRoommate] = useState(false);

  // Manage house / leave
  const [showManageHouse, setShowManageHouse] = useState(false);
  const [leavingHouse, setLeavingHouse] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await housesApi.get(id);
      const h: House = res.data.data;
      setHouse(h);
      setMembers(h.members ?? []);
    } catch {
      toast.error('House not found');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = members.find(m => m.userId === user?.id)?.role === 'admin';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      if (id && addMemberEmail) {
        await housesApi.addMemberByEmail(id as string, addMemberEmail);
        toast.success(`Member added successfully`);
        setShowAddMember(false);
        setAddMemberEmail('');
        load();
      }
    } catch {
      toast.error('Failed to add member. Check the email and try again.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleLeaveHouse = async () => {
    if (!id || !confirm('Leave this house? You will lose access to its tasks and expenses.')) return;
    setLeavingHouse(true);
    try {
      await housesApi.leave(id as string);
      toast.success('You have left the house');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to leave house';
      toast.error(msg);
    } finally {
      setLeavingHouse(false);
      setShowManageHouse(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!manageRoommateId || !id) return;
    setManagingRoommate(true);
    try {
      await housesApi.updateMember(id as string, manageRoommateId, 'inactive');
      toast.success('Member removed successfully');
      setManageRoommateId(null);
      load();
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setManagingRoommate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!house) return null;

  return (
    <div>
      {/* House header panel */}
      <div className="bg-white border border-[#E5E5E5] flex flex-col gap-6 rounded-xl p-8 shadow-sm md:flex-row md:items-start md:justify-between mb-8">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-3xl font-bold text-[#171717] tracking-tight">{house.name}</h1>
                  {isAdmin && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[#737373] font-light text-lg">{house.members?.length ?? 0} member{(house.members?.length ?? 0) !== 1 ? 's' : ''}</p>
                {house.inviteCode && isAdmin && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-[#737373]">Invite code:</span>
                    <code className="text-sm bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-lg font-mono text-[#171717] select-all">{house.inviteCode}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(house.inviteCode!); toast.success('Copied!'); }}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-semibold"
                    >Copy</button>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManageHouse(true)}
                    className="flex items-center gap-2 bg-white border border-[#E5E5E5] hover:border-black text-[#171717] px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm text-sm"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
                    Manage House
                  </button>
                </div>
              </div>

              {/* Roommates panel */}
              <div className="flex flex-col gap-4 bg-neutral-50 p-5 rounded-2xl border border-neutral-200 shrink-0">
                <p className="text-xs font-bold text-[#737373] uppercase tracking-widest">Roommates</p>
                <div className="flex -space-x-4 overflow-hidden p-1">
                  {members.map((m, i) => (
                    <div key={m.userId} onClick={() => isAdmin && m.userId !== user?.id && setManageRoommateId(m.userId)} className={`group relative transition-all hover:scale-105 ${isAdmin && m.userId !== user?.id ? 'cursor-pointer hover:z-20' : 'hover:z-10'}`}>
                      <div className="size-14 rounded-full ring-2 ring-white bg-neutral-800 flex items-center justify-center text-lg font-bold text-white shadow-sm">
                        {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 block size-4 rounded-full ring-2 ring-white ${m.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'
                          }`}
                      />
                    </div>
                  ))}
                  {isAdmin && (
                    <button onClick={() => setShowAddMember(true)} className="flex size-14 z-10 items-center justify-center rounded-full bg-white ring-2 ring-neutral-200 hover:ring-black transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: '20px' }}>add</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="w-full mb-8">
              <nav className="flex gap-2 p-1.5 overflow-x-auto bg-neutral-100 rounded-xl border border-neutral-200">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`group flex-1 inline-flex justify-center items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${tab === t.id
                      ? 'bg-white text-[#171717] shadow-sm ring-1 ring-black/5'
                      : 'text-[#737373] hover:text-[#171717] hover:bg-white/50'
                      }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 shadow-sm">
              {tab === 'tasks' && <TasksTab house={house} members={members} isAdmin={isAdmin} />}
              {tab === 'chat' && <ChatTab houseId={id as string} members={members} />}
              {tab === 'expenses' && <ExpensesTab houseId={id as string} members={members} />}
              {tab === 'leaderboard' && <LeaderboardTab houseId={id as string} />}
              {tab === 'swaps' && <SwapsTab houseId={id as string} members={members} />}
              {tab === 'penalties' && <PenaltiesSection houseId={id as string} members={members} isAdmin={isAdmin} />}
            </div>

      {/* Add Member Modal */}
      {isAdmin && (
        <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Roommate">
          <form onSubmit={handleAddMember} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#171717] mb-1">Email Address</label>
              <input
                className="w-full rounded-lg border border-[#E5E5E5] px-4 py-2.5 text-[#171717] focus:border-black focus:ring-1 focus:ring-black transition-all"
                type="email"
                placeholder="john.doe@example.com"
                value={addMemberEmail}
                onChange={e => setAddMemberEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" className="flex-1 border border-[#E5E5E5] text-[#171717] font-semibold py-2.5 rounded-lg hover:bg-neutral-50 transition-all" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button type="submit" className="flex-1 bg-black text-white font-semibold py-2.5 rounded-lg hover:bg-neutral-800 transition-all" disabled={addingMember}>
                {addingMember ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage House Modal */}
      <Modal open={showManageHouse} onClose={() => setShowManageHouse(false)} title="Manage House">
        <div className="flex flex-col gap-5">
          {house.inviteCode && isAdmin && (
            <div>
              <p className="text-sm font-semibold text-[#171717]">Invite code</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm">{house.inviteCode}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(house.inviteCode!); toast.success('Copied!'); }}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {isAdmin && (
            <p className="text-sm text-[#737373]">
              Tap a roommate avatar above to remove them from the house. Pending tasks assigned to removed members are expired automatically.
            </p>
          )}
          <div className="border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-[#171717]">Leave house</p>
            <p className="mt-1 text-sm text-[#737373]">
              You will no longer see this house&apos;s tasks, expenses, or chat.
              {isAdmin && ' If you are the only admin, promote someone else first.'}
            </p>
            <button
              type="button"
              onClick={handleLeaveHouse}
              disabled={leavingHouse}
              className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {leavingHouse ? 'Leaving…' : 'Leave House'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage/Remove Roommate Modal */}
      {isAdmin && (
        <Modal open={!!manageRoommateId} onClose={() => setManageRoommateId(null)} title="Manage Roommate">
          <div className="flex flex-col gap-4">
            <p className="text-[#737373]">Do you want to completely remove this member from the house?</p>
            <div className="flex gap-3 mt-4">
              <button type="button" className="flex-1 border border-[#E5E5E5] text-[#171717] font-semibold py-2.5 rounded-lg hover:bg-neutral-50 transition-all" onClick={() => setManageRoommateId(null)}>Cancel</button>
              <button type="button" className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 transition-all" onClick={handleRemoveMember} disabled={managingRoommate}>
                {managingRoommate ? 'Removing…' : 'Remove Member'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
