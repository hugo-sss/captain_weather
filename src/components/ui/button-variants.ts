import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg-0 hover:bg-accent/90',
        secondary: 'bg-bg-2 text-text-1 border border-border hover:bg-bg-2/70',
        ghost: 'text-text-2 hover:bg-bg-2 hover:text-text-1',
        outline: 'border border-border bg-transparent text-text-1 hover:bg-bg-2',
        destructive: 'bg-risk-red/20 text-risk-red border border-risk-red/40 hover:bg-risk-red/30',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', lg: 'h-10 rounded-md px-8', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

