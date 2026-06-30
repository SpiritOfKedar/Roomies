'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { LandingNav } from './LandingNav';
import { LandingFooter } from './LandingFooter';
import { HeroSection } from './sections/HeroSection';
import { ShowcaseSection } from './sections/ShowcaseSection';
import { CTASection } from './sections/CTASection';

gsap.registerPlugin(ScrollTrigger);

export function LandingPage() {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh);
    const timeout = window.setTimeout(refresh, 500);

    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);

  return (
    <div className="bg-landing-bg text-landing-fg min-h-screen font-display antialiased selection:bg-white/20">
      <LandingNav />
      <main>
        <HeroSection reducedMotion={reducedMotion} />
        <ShowcaseSection reducedMotion={reducedMotion} />
        <CTASection reducedMotion={reducedMotion} />
      </main>
      <LandingFooter />
    </div>
  );
}
