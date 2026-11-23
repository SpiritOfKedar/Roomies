'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { housesApi, swapsApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import HouseTabs, { isHouseTab, type HouseTab } from './components/HouseTabs';
import { useHouseDashboard } from '@/hooks/useHouseDashboard';
import { useAuth } from '@/hooks/useAuth';
import TasksTab, { type TaskView } from './components/TasksTab';
import BellToggle from '@/components/ui/reactbits/bell-toggle';
import { useHouseAlerts, useNeedsNotifier } from '@/hooks/useHouseAlerts';
import Loader from '@/components/ui/Loader';
import SubmitButton from '@/components/ui/SubmitButton';
import SlideToConfirm from '@/components/ui/SlideToConfirm';
import { useActionStatus } from '@/hooks/useActionStatus';
import { getApiErrorMessage } from '@/lib/api-error';
import { computeNeedsYou } from '@/lib/turn-status';
import ExpensesTab from './components/expenses/ExpensesTab';
import LeaderboardTab from './components/leaderboard/LeaderboardTab';
import SwapsTab from './components/SwapsTab';
import ChatTab from './components/chat/ChatTab';
import PenaltiesSection from './components/PenaltiesSection';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';

export default function HousePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // The open section lives in the URL (?tab=chat) so refresh, back and shared links keep it.
  const tabParam = searchParams.get('tab');
  const tab: HouseTab = isHouseTab(tabParam) ? tabParam : 'tasks';
  const setTab = (next: HouseTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'tasks') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [taskView, setTaskView] = useState<TaskView>('needs');

  // Alerts on: poll every minute (also in the background) so new turns can notify.
  const alerts = useHouseAlerts(id);
  const { data: dashboard, isLoading, isError } = useHouseDashboard(id, 'active', {
    pollMs: alerts.enabled ? 60_000 : undefined,
  });

  const house = dashboard?.house ?? null;
  const members = house?.members ?? [];
  const isAdmin = members.find((m) => m.userId === user?.id)?.role === 'admin';

  // Turns to do, reviews to cast and fixes to make — drives the bell badge.
  const needsCount = useMemo(
    () =>
      computeNeedsYou(dashboard?.chores.items ?? [], dashboard?.voteStatuses ?? {}, user?.id, members).count,
    [dashboard, user?.id, members],
  );
  useNeedsNotifier(id, house?.name, dashboard ? needsCount : null, alerts.enabled);

  // Same query (and cache) as SwapsTab, so the badge and the tab stay in sync.
  const { data: swaps = [] } = useQuery({
    queryKey: queryKeys.swaps(id),
    queryFn: async () => (await swapsApi.list(id)).data.data ?? [],
    enabled: !!id,
  });
  const incomingSwaps = swaps.filter((s) => s.status === 'pending' && s.receiverId === user?.id).length;

  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const addMemberAction = useActionStatus();

  const [manageRoommateId, setManageRoommateId] = useState<string | null>(null);
  const removeAction = useActionStatus();

  const [showManageHouse, setShowManageHouse] = useState(false);
  const leaveAction = useActionStatus();

  const refreshHouse = () => {
    queryClient.invalidateQueries({ queryKey: ['house', id] });
  };

  useEffect(() => {
    if (isError) {
      toast.error('House not found');
      router.push('/dashboard');
    }
  }, [isError, router]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addMemberEmail) return;
    try {
      await addMemberAction.run(() => housesApi.addMemberByEmail(id as string, addMemberEmail));
      toast.success('Roommate added');
      setShowAddMember(false);
      setAddMemberEmail('');
      refreshHouse();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not add them. Check the email and try again.'));
    }
  };

  // Started by the slide-to-confirm in Manage House (no browser confirm dialog).
  const handleLeaveHouse = async () => {
    if (!id) return;
    try {
      await leaveAction.run(() => housesApi.leave(id as string));
      toast.success('You have left the house');
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not leave the house'));
    }
  };

  const handleRemoveMember = async () => {
    if (!manageRoommateId || !id) return;
    try {
      await removeAction.run(() => housesApi.updateMember(id as string, manageRoommateId, 'inactive'));
      toast.success('Roommate removed');
      setManageRoommateId(null);
      refreshHouse();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not remove them'));
    }
  };

  return (
    <div>
      {house ? (
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
            <p className="text-[#737373] font-light text-lg">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
            {house.inviteCode && isAdmin && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-[#737373]">Invite code:</span>
                <code className="text-sm bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-lg font-mono text-[#171717] select-all">
                  {house.inviteCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(house.inviteCode!);
                    toast.success('Copied!');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-semibold"
                >
                  Copy
                </button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* One control: on = badge with what's waiting on you + browser alerts; off = silenced */}
              <BellToggle
                pressed={alerts.enabled}
                onChange={alerts.setEnabled}
                offLabel="Alerts off"
                onLabel="Alerts on"
                label={
                  alerts.enabled
                    ? `Alerts on${needsCount ? `, ${needsCount} waiting on you` : ''}. Turn off`
                    : 'Alerts off. Turn on'
                }
                badge
                count={needsCount}
                color="#171717"
                background="#f5f5f5"
                onColor="#ffffff"
                onBackground="#171717"
                size="md"
              />
              <button
                type="button"
                onClick={() => setShowManageHouse(true)}
                className="flex items-center gap-2 bg-white border border-[#E5E5E5] hover:border-black text-[#171717] px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm text-sm"
              >
                <Icon name="settings" size={18} />
                Manage House
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-neutral-50 p-5 rounded-2xl border border-neutral-200 shrink-0">
            <p className="text-xs font-bold text-[#737373] uppercase tracking-widest">Roommates</p>
            <div className="flex -space-x-4 overflow-hidden p-1">
              {members.map((m) => (
                <div
                  key={m.userId}
                  onClick={() => isAdmin && m.userId !== user?.id && setManageRoommateId(m.userId)}
                  className={`group relative transition-all hover:scale-105 ${isAdmin && m.userId !== user?.id ? 'cursor-pointer hover:z-20' : 'hover:z-10'}`}
                >
                  <div className="size-14 rounded-full ring-2 ring-white bg-neutral-800 flex items-center justify-center text-lg font-bold text-white shadow-sm">
                    {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 block size-4 rounded-full ring-2 ring-white ${
                      m.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'
                    }`}
                  />
                </div>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="flex size-14 z-10 items-center justify-center rounded-full bg-white ring-2 ring-neutral-200 hover:ring-black transition-colors shadow-sm"
                >
                  <Icon name="add" size={20} className="text-neutral-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <HouseTabs
        active={tab}
        onChange={setTab}
        badges={{ tasks: needsCount, swaps: incomingSwaps }}
      />

      <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 shadow-sm">
        {house && tab === 'tasks' && (
          <TasksTab
            house={house}
            members={members}
            isAdmin={!!isAdmin}
            prefetchedDashboard={dashboard}
            view={taskView}
            onViewChange={setTaskView}
          />
        )}
        {house && tab === 'chat' && (
          <ChatTab houseId={id as string} members={members} isActive={tab === 'chat'} />
        )}
        {house && tab === 'expenses' && <ExpensesTab houseId={id as string} members={members} />}
        {house && tab === 'leaderboard' && <LeaderboardTab houseId={id as string} />}
        {house && tab === 'swaps' && <SwapsTab houseId={id as string} members={members} />}
        {house && tab === 'penalties' && (
          <PenaltiesSection houseId={id as string} members={members} isAdmin={!!isAdmin} />
        )}
        {isLoading && !house && <Loader label="Loading house" />}
      </div>

      {isAdmin && (
        <Modal
          open={showAddMember}
          onClose={() => setShowAddMember(false)}
          title="Add a roommate"
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowAddMember(false)}>
                Cancel
              </button>
              <SubmitButton
                form="add-member-form"
                status={addMemberAction.status}
                className="flex-1"
                disabled={!addMemberEmail.includes('@')}
                labels={{ running: 'Adding…', done: 'Added', failed: 'Try again' }}
              >
                Add roommate
              </SubmitButton>
            </div>
          }
        >
          <form id="add-member-form" onSubmit={handleAddMember} className="flex flex-col gap-2">
            <label className="label" htmlFor="member-email">Their email</label>
            <input
              id="member-email"
              className="input"
              type="email"
              placeholder="name@example.com"
              value={addMemberEmail}
              onChange={(e) => setAddMemberEmail(e.target.value)}
              required
            />
            <p className="text-sm text-neutral-500">They need a Roomies account first. Or share the invite code instead.</p>
          </form>
        </Modal>
      )}

      <Modal open={showManageHouse} onClose={() => setShowManageHouse(false)} title="Manage House">
        <div className="flex flex-col gap-5">
          {house?.inviteCode && isAdmin && (
            <div>
              <p className="text-sm font-semibold text-[#171717]">Invite code</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm">
                  {house.inviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(house.inviteCode!);
                    toast.success('Copied!');
                  }}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {isAdmin && (
            <p className="text-sm text-[#737373]">
              Tap a roommate avatar above to remove them from the house. Pending tasks assigned to removed
              members are expired automatically.
            </p>
          )}
          <div className="border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-[#171717]">Leave house</p>
            <p className="mt-1 text-sm text-[#737373]">
              You will no longer see this house&apos;s tasks, expenses, or chat.
              {isAdmin && ' If you are the only admin, promote someone else first.'}
            </p>
            <SlideToConfirm
              className="mt-3"
              label="Slide to leave this house"
              status={leaveAction.status}
              onConfirm={handleLeaveHouse}
              labels={{ running: 'Leaving…', done: 'Left the house', failed: 'Could not leave' }}
            />
          </div>
        </div>
      </Modal>

      {isAdmin && (
        <Modal
          open={!!manageRoommateId}
          onClose={() => setManageRoommateId(null)}
          title={`Remove ${manageRoommateId ? members.find((m) => m.userId === manageRoommateId)?.user?.name ?? 'roommate' : 'roommate'}?`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              They lose access to this house. Turns they haven&apos;t handed in are expired, and their past
              chores and expenses stay in the history.
            </p>
            <SlideToConfirm
              label="Slide to remove"
              status={removeAction.status}
              onConfirm={handleRemoveMember}
              labels={{ running: 'Removing…', done: 'Removed', failed: 'Could not remove' }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
