import * as React from 'react';
import { cn } from '@/lib/utils.ts';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn('flex h-9 w-full rounded-md border border-border bg-bg-0 px-3 py-1 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50', type === 'number' && 'num', className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
export { Input };
