import { useRef } from 'react';
import { cn } from '@/lib/utils.ts';

export type SegmentedOption<T extends string> = { value: T; label: string; disabled?: boolean; title?: string };

type Props<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
};

/** Two to four options, one active. Arrow keys move between them. Used for Simple / Detailed and chart modes. */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'md', fullWidth, className }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const enabled = options.map((o, j) => (o.disabled ? -1 : j)).filter((j) => j >= 0);
    const pos = enabled.indexOf(i);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center rounded-lg bg-bg-0/70 border border-border-soft p-0.5', fullWidth && 'flex w-full', className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} disabled={o.disabled} title={o.title}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={cn('rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 whitespace-nowrap', size === 'sm' ? 'h-[26px] px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]', fullWidth && 'flex-1', active ? 'bg-bg-2 text-text-1 shadow-[0_1px_2px_rgba(0,0,0,0.35)]' : 'text-text-2 hover:text-text-1')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
