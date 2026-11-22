'use client';

import { DotCircle } from '@/components/ui/oxyn/dot-circle';
import { cn } from '@/lib/utils';

interface LoaderProps {
  /** Canvas size in px */
  size?: number;
  /** Screen-reader text, also shown under the loader when `showLabel` */
  label?: string;
  showLabel?: boolean;
  /** Center in the full viewport (auth / route loading) */
  fullscreen?: boolean;
  className?: string;
}

/** App-wide loading indicator: oxyn's dot-circle "ping" (a request and its echo). */
export default function Loader({
  size = 64,
  label = 'Loading',
  showLabel = false,
  fullscreen = false,
  className,
}: LoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullscreen ? 'min-h-screen bg-[#FAFAFA]' : 'py-12',
        className,
      )}
    >
      <DotCircle
        animation="ping"
        size={size}
        density={11}
        dotSize={size / 40}
        color="#171717"
        minOpacity={0.12}
        label={label}
      />
      {showLabel && <p className="text-sm font-medium text-neutral-500">{label}…</p>}
    </div>
  );
}
