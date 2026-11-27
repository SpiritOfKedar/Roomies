/**
 * Right-hand panel for the auth pages: the same warm "lit" ground and white Roomies screens as the
 * landing page, so signing in feels like the same product. Shows a real chore turn, not a testimonial.
 */
type Props = {
  title: string;
  line: string;
};

const CHECK = (
  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

function Avatar({ letter, active }: { letter: string; active?: boolean }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#262626] text-xs font-bold text-white">
      {letter}
      {active && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
    </span>
  );
}

export default function AuthShowcase({ title, line }: Props) {
  return (
    <div className="hidden lg:flex lg:w-1/2 p-4">
      <div
        className="relative flex w-full flex-col justify-between overflow-hidden rounded-[28px] p-12 xl:p-16"
        style={{
          backgroundColor: '#d9ccb7',
          backgroundImage:
            'radial-gradient(70% 90% at 12% 0%, #efe8dc, transparent 70%), radial-gradient(60% 80% at 100% 100%, #c4a27f, transparent 72%)',
        }}
      >
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#2a2622] xl:text-4xl">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-[#4d463e]">{line}</p>
        </div>

        <div className="relative mt-12 h-[360px] xl:h-[400px]" aria-hidden="true">
          {/* the turn, as the app shows it */}
          <div className="absolute left-0 top-0 w-[min(100%,380px)] rounded-3xl border border-white/70 bg-white p-5 shadow-[0_2px_4px_rgb(0_0_0/0.05),0_30px_60px_-24px_rgb(0_0_0/0.45)] motion-safe:animate-[auth-float_7s_ease-in-out_infinite]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#171717] text-white">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="m3 17 2 2 4-4" /><path d="M13 18h8" /></svg>
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight text-[#171717]">Wash up after dinner</p>
                <p className="text-xs text-[#737373]">Repeats after each turn · 10 points</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#fafafa] p-3 ring-1 ring-black/5">
              <Avatar letter="A" active />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#171717]">Aditi&apos;s turn</p>
                <p className="text-xs text-[#737373]">Handed in with a photo · 21:40</p>
              </div>
              <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500 text-white">{CHECK}</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">In review</span>
              <span className="text-xs font-semibold text-[#737373]">1 of 2 approvals</span>
            </div>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><span className="block h-full w-1/2 rounded-full bg-[#171717]" /></span>
            <div className="mt-4 flex gap-2">
              <span className="rounded-full bg-[#171717] px-4 py-2 text-xs font-semibold text-white">Approve</span>
              <span className="rounded-full px-4 py-2 text-xs font-semibold text-[#171717] ring-1 ring-[#e5e5e5]">Request changes</span>
            </div>
          </div>

          {/* who voted */}
          <div className="absolute bottom-2 right-0 w-56 rounded-2xl border border-white/70 bg-white p-4 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.45)] motion-safe:animate-[auth-float_8s_ease-in-out_-3s_infinite] xl:right-6">
            <p className="text-xs font-semibold text-[#737373]">Votes</p>
            {[
              { l: 'M', n: 'Mei Tan', s: 'Approved', ok: true },
              { l: 'L', n: 'Leo Marsh', s: 'Waiting', ok: false },
            ].map((v) => (
              <div key={v.n} className="mt-2.5 flex items-center gap-2.5">
                <Avatar letter={v.l} />
                <span className="flex-1 text-sm text-[#171717]">{v.n}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{v.s}</span>
              </div>
            ))}
          </div>

          {/* the bill */}
          <div className="absolute bottom-0 left-10 rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.45)] motion-safe:animate-[auth-float_9s_ease-in-out_-5s_infinite]">
            <p className="text-xs font-semibold text-[#737373]">Groceries</p>
            <p className="text-xl font-bold tracking-tight text-[#171717]">₹2,480</p>
            <p className="text-xs font-semibold text-[#404040]">₹620 each · split between 4</p>
          </div>
        </div>
      </div>
    </div>
  );
}
