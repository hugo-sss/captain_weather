// Hand-built overflow menu (no @radix-ui/react-dropdown-menu in this sandbox). Button with aria-haspopup,
// Escape and outside click close it, arrow keys move focus, Home/End jump, Enter or Space activate.
import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Link } from 'react-router-dom';
import { EllipsisVertical, type LucideIcon } from 'lucide-react';
import { buttonVariants } from './button-variants.ts';
import { cn } from '@/lib/utils.ts';

export type MenuItem =
  | { kind?: 'item'; label: string; icon?: LucideIcon; onSelect?: () => void; href?: string; /** One sentence shown under the label. */ hint?: string; danger?: boolean; disabled?: boolean; external?: boolean }
  | { kind: 'divider' }
  | { kind: 'heading'; label: string };

type Props = {
  /** Accessible name for the trigger (default trigger is an ellipsis icon button). */
  label: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  /** Custom trigger element; receives ref, onClick and aria props. */
  trigger?: ReactElement;
  className?: string;
  menuClassName?: string;
};

export function DropdownMenu({ label, items, align = 'end', trigger, className, menuClassName }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const id = useId();

  const close = useCallback((refocus = false) => { setOpen(false); if (refocus) triggerRef.current?.focus(); }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    // Focus the first enabled item once the menu is in the DOM.
    const t = window.setTimeout(() => { const first = itemRefs.current.find((el) => el && !el.hasAttribute('aria-disabled')); first?.focus(); }, 0);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); window.clearTimeout(t); };
  }, [open, close]);

  const focusables = () => itemRefs.current.filter((el): el is HTMLElement => !!el && !el.hasAttribute('aria-disabled'));
  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = focusables();
    if (els.length === 0) return;
    const cur = els.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (cur + 1) % els.length;
    else if (e.key === 'ArrowUp') next = (cur - 1 + els.length) % els.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = els.length - 1;
    else if (e.key === 'Tab') { close(); return; }
    if (next === null) return;
    e.preventDefault();
    els[next].focus();
  };

  const toggle = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); };
  const triggerEl = trigger
    ? <Slot ref={triggerRef} onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}>{trigger}</Slot>
    : <button ref={triggerRef} type="button" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), open && 'bg-bg-2 text-text-1')} aria-label={label} onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}><EllipsisVertical /></button>;

  // Focusable index per entry (dividers and headings take none), computed once per render.
  const indices = items.reduce<number[]>((acc, it) => { const prev = acc.length ? Math.max(...acc) : -1; acc.push(it.kind === 'divider' || it.kind === 'heading' ? -1 : prev + 1); return acc; }, []);
  return (
    <div ref={wrap} className={cn('relative inline-block', className)} onClick={(e) => e.stopPropagation()}>
      {triggerEl}
      {open && (
        <div id={id} role="menu" aria-label={label} onKeyDown={onMenuKey}
          className={cn('absolute top-full mt-1.5 z-[1100] min-w-[228px] max-w-[300px] rounded-xl border border-border-soft bg-bg-2 p-1 shadow-pop animate-in fade-in-0 zoom-in-95 duration-150', align === 'end' ? 'right-0' : 'left-0', menuClassName)}>
          {items.map((it, i) => {
            if (it.kind === 'divider') return <div key={`d${i}`} role="separator" className="my-1 h-px bg-border-soft" />;
            if (it.kind === 'heading') return <div key={`h${i}`} className="label px-2.5 pt-2 pb-1 truncate">{it.label}</div>;
            const idx = indices[i];
            const Icon = it.icon;
            const inner = (
              <>
                {Icon && <Icon className={cn('h-4 w-4 shrink-0 mt-px', it.danger ? 'text-risk-red' : 'text-text-3')} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.label}</span>
                  {it.hint && <span className="block text-[12px] leading-snug text-text-3 whitespace-normal">{it.hint}</span>}
                </span>
              </>
            );
            const cls = cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] leading-snug transition-colors focus:outline-none focus:bg-bg-1 hover:bg-bg-1', it.danger ? 'text-risk-red' : 'text-text-1', it.disabled && 'opacity-40 pointer-events-none');
            const setRef = (el: HTMLElement | null) => { itemRefs.current[idx] = el; };
            if (it.href && !it.disabled) {
              return it.external
                ? <a key={`i${i}`} ref={setRef as (el: HTMLAnchorElement | null) => void} role="menuitem" tabIndex={-1} href={it.href} target="_blank" rel="noreferrer" className={cls} onClick={() => { close(); it.onSelect?.(); }}>{inner}</a>
                : <Link key={`i${i}`} ref={setRef as (el: HTMLAnchorElement | null) => void} role="menuitem" tabIndex={-1} to={it.href} className={cls} onClick={() => { close(); it.onSelect?.(); }}>{inner}</Link>;
            }
            return (
              <button key={`i${i}`} ref={setRef as (el: HTMLButtonElement | null) => void} type="button" role="menuitem" tabIndex={-1} aria-disabled={it.disabled || undefined} className={cls}
                onClick={() => { if (it.disabled) return; close(true); it.onSelect?.(); }}>
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Convenience for a menu opened from a labelled button (e.g. "Map options"). */
export function MenuButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button type="button" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), className)} {...rest}>{children}</button>;
}
