'use client';

import GlideSelect, { type GlideSelectOption } from '@/components/ui/reactbits/glide-select';

export type SelectOption = GlideSelectOption;

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Form dropdown: React Bits glide select in the app's light theme, full width. */
export default function Select({ label, value, options, onChange, placeholder, disabled }: Props) {
  return (
    <div>
      <p className="label">{label}</p>
      <GlideSelect
        ariaLabel={label}
        value={value}
        options={options}
        onChange={(v) => onChange(v)}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth
        size="lg"
        radius={10}
        surfaceColor="#f5f5f5"
        highlightColor="#e5e5e5"
        textColor="#171717"
        accentColor="#171717"
      />
    </div>
  );
}
