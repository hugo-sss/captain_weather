import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg-0 hover:bg-[#5EE3D2] shadow-[0_1px_0_rgba(0,0,0,0.3)]',
        secondary: 'bg-bg-2 text-text-1 border border-border hover:border-text-3/60 hover:bg-[#1C2A42]',
        ghost: 'text-text-2 hover:bg-bg-2 hover:text-text-1',
        outline: 'border border-border bg-transparent text-text-1 hover:bg-bg-2',
        destructive: 'bg-risk-red/15 text-risk-red border border-risk-red/40 hover:bg-risk-red/25',
        link: 'text-accent underline-offset-4 hover:underline px-0',
      },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', xs: 'h-7 rounded-md px-2.5 text-xs', lg: 'h-10 rounded-md px-8', icon: 'h-8 w-8' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
