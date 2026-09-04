import * as React from 'react';
import { cn } from '@/lib/utils.ts';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn('flex h-9 w-full rounded-md border border-border bg-bg-0 px-3 py-1 text-sm text-text-1 placeholder:text-text-3 transition-colors hover:border-text-3/60 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50', (type === 'number' || type === 'datetime-local') && 'num', className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
export { Input };
