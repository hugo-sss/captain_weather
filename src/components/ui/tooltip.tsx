import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils.ts';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-[1300] max-w-xs rounded-lg border border-border-soft bg-bg-2 px-3 py-2 text-[12px] leading-snug text-text-1 shadow-pop animate-in fade-in-0 zoom-in-95 duration-150', className)} {...props} />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';
