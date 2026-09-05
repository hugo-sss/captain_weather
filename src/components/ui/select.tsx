import * as React from 'react';
import { cn } from '@/lib/utils.ts';
// Native select, styled. Enough for v1; swap for Radix Select if needed.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('flex h-9 w-full rounded-md border border-border bg-bg-0 px-2.5 text-sm text-text-1 transition-colors hover:border-text-3/60 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30', className)} {...props} />
));
Select.displayName = 'Select';
