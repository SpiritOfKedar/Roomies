'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapScope } from '../hooks/useGsapScope';
import { REVEAL_EASE } from '../utils/gsapDefaults';

gsap.registerPlugin(ScrollTrigger);

type ShowcaseSectionProps = {
  reducedMotion: boolean;
};

function ChoreMock() {
  return (
    <div className="space-y-3 p-1">
      {['Clean the fridge', 'Take out trash', 'Vacuum living room'].map((task, i) => (
        <div
          key={task}
          className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
        >
          <div
            className={`h-4 w-4 rounded-full border ${i === 0 ? 'border-white/40 bg-white/20' : 'border-white/15'}`}
          />
          <span className="text-xs text-landing-muted">{task}</span>
          {i === 0 && (
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-landing-fg">
              Your turn
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function VotingMock() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <div className="flex -space-x-2">
        {['A', 'B', 'C'].map((l) => (
          <div
            key={l}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-landing-surface bg-white/10 text-[10px] font-bold text-landing-fg"
          >
            {l}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="rounded-full bg-white px-4 py-1.5 text-[10px] font-semibold text-landing-bg">
          Approve
        </div>
        <div className="rounded-full border border-white/15 px-4 py-1.5 text-[10px] text-landing-muted">
          Reject
        </div>
      </div>
    </div>
  );
}

function ExpenseMock() {
  return (
    <div className="space-y-2 p-1">
      {[
        { label: 'Groceries', amount: '$84.50' },
        { label: 'Internet', amount: '$60.00' },
      ].map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
        >
          <span className="text-xs text-landing-muted">{row.label}</span>
          <span className="text-xs font-semibold text-landing-fg">{row.amount}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 text-[10px]">
        <span className="text-landing-dim">Per person</span>
        <span className="font-semibold text-landing-fg">$72.25</span>
      </div>
    </div>
  );
}

function LeaderboardMock() {
  return (
    <div className="space-y-2 p-1">
      {[
        { name: 'Alex', pts: 120 },
        { name: 'Jordan', pts: 98 },
        { name: 'Sam', pts: 85 },
      ].map((row, i) => (
        <div key={row.name} className="flex items-center gap-2 text-xs">
          <span className="w-4 text-landing-dim">{i + 1}</span>
          <div className="h-5 w-5 rounded-full bg-white/10" />
          <span className="flex-1 text-landing-muted">{row.name}</span>
          <span className="font-semibold text-landing-fg">{row.pts}</span>
        </div>
      ))}
    </div>
  );
}

function ChatMock() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex gap-2">
        <div className="h-6 w-6 shrink-0 rounded-full bg-white/10" />
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2 text-[11px] text-landing-muted">
          Who&apos;s doing dishes this week?
        </div>
      </div>
      <div className="flex flex-row-reverse gap-2">
        <div className="h-6 w-6 shrink-0 rounded-full bg-white/20" />
        <div className="rounded-2xl rounded-tr-sm bg-white/10 px-3 py-2 text-[11px] text-landing-fg">
          Rotation says it&apos;s Alex. Check the app
        </div>
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: 'Fair chore rotation',
    description: 'Recurring templates with a rotation engine that weighs history and fairness.',
    className: 'md:col-span-2 md:row-span-2',
    mock: <ChoreMock />,
  },
  {
    title: 'Peer voting',
    description: 'Proof submissions reviewed by roommates with majority threshold.',
    className: 'md:col-span-1',
    mock: <VotingMock />,
  },
  {
    title: 'Expense splits',
    description: 'Equal splits across active members with settlement tracking.',
    className: 'md:col-span-1',
    mock: <ExpenseMock />,
  },
  {
    title: 'Leaderboard',
    description: 'See who is pulling their weight at a glance.',
    className: 'md:col-span-1',
    mock: <LeaderboardMock />,
  },
  {
    title: 'House chat',
    description: 'Coordinate in a shared channel scoped to your house.',
    className: 'md:col-span-2',
    mock: <ChatMock />,
  },
];

export function ShowcaseSection({ reducedMotion }: ShowcaseSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGsapScope(
    sectionRef,
    () => {
      const cards = sectionRef.current?.querySelectorAll('.showcase-card');
      if (!cards?.length) return;

      cards.forEach((card, i) => {
        gsap.from(card, {
          y: 32,
          autoAlpha: 0,
          duration: 0.5,
          ease: REVEAL_EASE,
          delay: i * 0.05,
          scrollTrigger: {
            trigger: card,
            start: 'top 92%',
            once: true,
          },
        });
      });
    },
    [],
    !reducedMotion,
  );

  return (
    <section id="showcase" className="relative px-6 py-24 md:py-32">
      <div id="features" className="absolute -top-20" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-landing-fg md:text-5xl">
          Showcase
        </h2>
        <p className="mx-auto mt-4 max-w-md text-center text-sm text-landing-muted md:text-base">
          Everything your household needs in one place: chores, bills, votes and accountability.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className={`showcase-card group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-landing-surface p-6 transition-colors hover:border-white/[0.14] ${card.className}`}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
              <div className="relative">
                <h3 className="text-sm font-semibold text-landing-fg">{card.title}</h3>
                <p className="mt-1 text-xs text-landing-dim leading-relaxed">{card.description}</p>
                <div className="mt-5 rounded-xl border border-white/[0.06] bg-landing-bg/60 p-4">
                  {card.mock}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
