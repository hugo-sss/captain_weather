import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { LoaderCircle } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from './button-variants.ts';
import { cn } from '@/lib/utils.ts';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner in place of the leading icon and disables the button. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  if (asChild) return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{children}</Comp>;
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Comp>
  );
});
Button.displayName = 'Button';
export { Button };
