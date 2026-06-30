'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  ListTodo,
  MessageCircle,
  Receipt,
  Trophy,
  Users,
  Vote,
} from 'lucide-react';
import { PillBadge } from '../ui/PillBadge';
import { GlowButton } from '../ui/GlowButton';
import { splitWords } from '../utils/splitWords';
import { REVEAL_EASE, STAGGER } from '../utils/gsapDefaults';

const STACK_ICONS = [
  { Icon: ListTodo, label: 'Chores' },
  { Icon: Vote, label: 'Voting' },
  { Icon: Receipt, label: 'Expenses' },
  { Icon: Users, label: 'Houses' },
  { Icon: Trophy, label: 'Leaderboard' },
  { Icon: MessageCircle, label: 'Chat' },
];

type HeroSectionProps = {
  reducedMotion: boolean;
};

export function HeroSection({ reducedMotion }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;

      const tl = gsap.timeline({ defaults: { ease: REVEAL_EASE } });

      if (badgeRef.current) {
        tl.from(badgeRef.current, { y: 16, autoAlpha: 0, duration: 0.5 });
      }

      const words = headlineRef.current?.querySelectorAll('.word-inner');
      if (words?.length) {
        tl.from(
          words,
          {
            yPercent: 110,
            clipPath: 'inset(100% 0% 0% 0%)',
            duration: 0.8,
            stagger: STAGGER,
          },
          '-=0.2',
        );
      }

      if (subtitleRef.current) {
        tl.from(subtitleRef.current, { y: 20, autoAlpha: 0, duration: 0.55 }, '-=0.4');
      }

      if (ctaRef.current) {
        tl.from(ctaRef.current, { y: 16, autoAlpha: 0, duration: 0.5 }, '-=0.3');
      }

      if (iconsRef.current) {
        tl.from(
          iconsRef.current.children,
          { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.06 },
          '-=0.2',
        );
      }
    },
    { scope: sectionRef, dependencies: [reducedMotion] },
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-14"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_75%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-white/[0.04] blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <div ref={badgeRef} className="mb-8">
          <PillBadge href="#showcase" label="Introducing fair rotation" />
        </div>

        <h1
          ref={headlineRef}
          className="text-4xl font-bold tracking-tight text-landing-fg sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1]"
        >
          {splitWords('Shared living,')}
          <br />
          {splitWords('fairly divided.')}
        </h1>

        <p
          ref={subtitleRef}
          className="mt-6 max-w-lg text-base text-landing-muted md:text-lg leading-relaxed"
        >
          The fairness-driven platform for roommates. Coordinate chores, split expenses,
          and keep everyone accountable.
        </p>

        <div ref={ctaRef} className="relative mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-20 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.06] blur-3xl"
            aria-hidden="true"
          />
          <GlowButton href="/register">Get started</GlowButton>
          <GlowButton href="#showcase" variant="secondary">
            <span className="flex items-center gap-2">
              See features
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </GlowButton>
        </div>

        <div
          ref={iconsRef}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
        >
          {STACK_ICONS.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 text-landing-dim transition-colors hover:text-landing-muted"
              title={label}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
