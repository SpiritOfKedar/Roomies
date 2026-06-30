'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RefObject } from 'react';

gsap.registerPlugin(ScrollTrigger);

export function useGsapScope(
  scope: RefObject<HTMLElement | null>,
  callback: () => void,
  deps: unknown[] = [],
  enabled = true,
) {
  useGSAP(
    () => {
      if (!enabled) return;
      callback();
    },
    { scope, dependencies: [enabled, ...deps] },
  );
}
