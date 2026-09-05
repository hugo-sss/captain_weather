import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils.ts';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-[1100] max-w-xs rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-xs leading-snug text-text-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] animate-in fade-in-0 zoom-in-95 duration-150', className)} {...props} />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';
