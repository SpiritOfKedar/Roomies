'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { housesApi } from '@/lib/endpoints';
import type { House } from '@/types';
import Modal from '@/components/Modal';
import toast from 'react-hot-toast';

/* Gradient palette for house cover placeholders */
const COVER_GRADIENTS = [
  'from-slate-800 via-slate-700 to-slate-600',
  'from-zinc-800 via-zinc-700 to-zinc-600',
  'from-stone-800 via-stone-700 to-amber-800',
  'from-neutral-800 via-neutral-700 to-neutral-600',
  'from-gray-800 via-gray-700 to-gray-600',
  'from-slate-900 via-indigo-900 to-slate-800',
];

export default function DashboardPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Create House modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAddr, setCreateAddr] = useState('');
  const [creating, setCreating] = useState(false);

  // Join House modal state
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await housesApi.list();
      setHouses(res.data.data ?? []);
    } catch {
      toast.error('Failed to load houses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await housesApi.create({ name: createName, address: createAddr });
      toast.success('House created!');
      setShowCreate(false);
      setCreateName(''); setCreateAddr('');
      load();
    } catch {
      toast.error('Failed to create house');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      await housesApi.join(joinCode.trim());
      toast.success('Joined house!');
      setShowJoin(false);
      setJoinCode('');
      load();
    } catch {
      toast.error('Invalid or expired invite code');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-3xl font-bold text-[#171717] tracking-tight mb-2">Your Houses</h2>
          <p className="text-[#737373] text-lg font-light">Manage your shared living spaces or join a new one.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 bg-white border border-[#E5E5E5] hover:border-black text-[#171717] px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[#737373]" style={{ fontSize: '18px' }}>login</span>
            Join via ID
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg text-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_home</span>
            Create New House
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5E5E5] animate-pulse h-[380px]" />
          ))}
        </div>
      ) : houses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Empty-state "Create" card */}
          <button
            onClick={() => setShowCreate(true)}
            className="group relative rounded-xl border border-dashed border-neutral-300 hover:border-black bg-neutral-50 hover:bg-white transition-all duration-300 flex flex-col items-center justify-center min-h-[380px] text-center p-8"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 text-neutral-400 group-hover:text-black">
              <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>add</span>
            </div>
            <h3 className="text-lg font-bold text-[#171717] mb-2">Create New House</h3>
            <p className="text-sm text-[#737373] max-w-[200px] font-light">Set up a new space to manage chores, bills and more.</p>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {houses.map((house, idx) => (
            <article
              key={house.id}
              className="group bg-white rounded-xl border border-[#E5E5E5] shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
              onClick={() => router.push(`/houses/${house.id}`)}
            >
              {/* Cover */}
              <div className={`h-48 w-full bg-gradient-to-br ${COVER_GRADIENTS[idx % COVER_GRADIENTS.length]} relative grayscale group-hover:grayscale-0 transition-all duration-500`}>
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
                {/* Status badge */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-[#171717] flex items-center gap-1.5 shadow-sm border border-neutral-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </div>
                {/* House name overlaid */}
                <div className="absolute bottom-5 left-5 text-white">
                  <h3 className="text-xl font-bold leading-tight">{house.name}</h3>
                  <p className="text-sm text-neutral-200 flex items-center gap-1 mt-1 font-light">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>group</span>
                    {house.members?.length ?? 0} member{(house.members?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col flex-1">
                {/* Member avatars */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex -space-x-2">
                    {(house.members ?? []).slice(0, 3).map((m, mi) => (
                      <div
                        key={m.userId ?? mi}
                        className="w-8 h-8 rounded-full border-2 border-white bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600"
                      >
                        {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    ))}
                    {(house.members?.length ?? 0) > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-xs font-bold text-[#737373]">
                        +{(house.members?.length ?? 0) - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[#737373] font-medium px-2 py-1 bg-neutral-50 rounded border border-neutral-100">
                    {house.members?.length ?? 0} Members
                  </span>
                </div>

                {/* Info rows */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between text-sm py-2 border-b border-dashed border-neutral-200">
                    <span className="text-[#737373] flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cleaning_services</span>
                      Next Chore
                    </span>
                    <span className="font-medium text-[#171717]">—</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-2 border-b border-dashed border-neutral-200">
                    <span className="text-[#737373] flex items-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>receipt_long</span>
                      Next Bill
                    </span>
                    <span className="font-medium text-[#171717]">—</span>
                  </div>
                </div>

                {/* Enter button */}
                <button className="mt-auto w-full py-2.5 bg-white border border-neutral-200 text-[#171717] font-semibold rounded-lg hover:bg-black hover:text-white hover:border-black transition-all flex items-center justify-center gap-2 group/btn text-sm">
                  Enter House
                  <span className="material-symbols-outlined transition-transform group-hover/btn:translate-x-1" style={{ fontSize: '16px' }}>arrow_forward</span>
                </button>
              </div>
            </article>
          ))}

          {/* "Create New" card */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
            className="group relative rounded-xl border border-dashed border-neutral-300 hover:border-black bg-neutral-50 hover:bg-white transition-all duration-300 flex flex-col items-center justify-center min-h-[380px] text-center p-8"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 text-neutral-400 group-hover:text-black">
              <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>add</span>
            </div>
            <h3 className="text-lg font-bold text-[#171717] mb-2">Create New House</h3>
            <p className="text-sm text-[#737373] max-w-[200px] font-light">Set up a new space to manage chores, bills and more.</p>
          </button>
        </div>
      )}

      {/* Create House Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create a House">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="label">House Name</label>
            <input className="input" placeholder="e.g. The Lakeview Pad" value={createName}
              onChange={e => setCreateName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Address (optional)</label>
            <input className="input" placeholder="123 Main St" value={createAddr}
              onChange={e => setCreateAddr(e.target.value)} />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join House Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join a House">
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="label">Invite Code</label>
            <input className="input" placeholder="Paste invite code here" value={joinCode}
              onChange={e => setJoinCode(e.target.value)} required />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowJoin(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={joining}>
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
