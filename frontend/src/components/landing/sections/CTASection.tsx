'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapScope } from '../hooks/useGsapScope';
import { GlowButton } from '../ui/GlowButton';
import { SpecularGetStarted } from '@/components/landing/ui/SpecularGetStarted';
import { REVEAL_EASE } from '../utils/gsapDefaults';

gsap.registerPlugin(ScrollTrigger);

type CTASectionProps = {
  reducedMotion: boolean;
};

export function CTASection({ reducedMotion }: CTASectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGsapScope(
    sectionRef,
    () => {
      if (!contentRef.current) return;
      gsap.from(contentRef.current, {
        y: 24,
        autoAlpha: 0,
        duration: 0.5,
        ease: REVEAL_EASE,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 88%',
          once: true,
        },
      });
    },
    [],
    !reducedMotion,
  );

  return (
    <section ref={sectionRef} className="relative px-6 py-24 md:py-32">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-[80px]"
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className="relative mx-auto max-w-2xl rounded-2xl border border-white/[0.08] bg-landing-surface px-8 py-16 text-center md:px-16"
      >
        <h2 className="text-3xl font-bold tracking-tight text-landing-fg md:text-4xl">
          Ready to live fairly?
        </h2>
        <p className="mt-4 text-sm text-landing-muted md:text-base">
          Create a house, invite your roommates, and let Roomies handle the rest.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.05] blur-2xl"
            aria-hidden="true"
          />
          <SpecularGetStarted />
          <GlowButton href="/login" variant="secondary">
            Sign in
          </GlowButton>
        </div>
      </div>
    </section>
  );
}
