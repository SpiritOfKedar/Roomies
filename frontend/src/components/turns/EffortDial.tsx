'use client';

import CometDial from '@/components/ui/reactbits/comet-dial';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
  /** Line under the dial, e.g. "40 pts · ₹20 if missed" */
  caption?: string;
}

/**
 * How big a job is, as a React Bits comet dial: drag or flick around the ring,
 * or focus it and use the arrow keys (Shift for ×10, Home/End for min/max).
 */
export default function EffortDial({ value, onChange, min = 1, max = 10, label, unit = '', size = 176, caption }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <CometDial
        value={value}
        defaultValue={value}
        min={min}
        max={max}
        step={1}
        unit={unit}
        label={label}
        accent="#171717"
        ink="#171717"
        size={size}
        thickness={6}
        onChange={onChange}
      />
      {caption && <p className="text-sm text-neutral-500">{caption}</p>}
    </div>
  );
}
