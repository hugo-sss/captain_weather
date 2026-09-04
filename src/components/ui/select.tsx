import * as React from 'react';
import { cn } from '@/lib/utils.ts';
// Native select, styled. Enough for v1; swap for Radix Select if needed.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('flex h-9 w-full rounded-md border border-border bg-bg-0 px-2 text-sm text-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', className)} {...props} />
));
Select.displayName = 'Select';
