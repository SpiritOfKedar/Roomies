'use client';

import { useRouter } from 'next/navigation';
import SpecularButton, { type SpecularButtonSize } from '@/components/ui/reactbits/SpecularButton';

export function SpecularGetStarted({
  children = 'Get started',
  size = 'md',
}: {
  children?: React.ReactNode;
  size?: SpecularButtonSize;
}) {
  const router = useRouter();
  return (
    <SpecularButton size={size} radius={999} onClick={() => router.push('/register')}>
      {children}
    </SpecularButton>
  );
}
