import { cva } from 'class-variance-authority';

// Sizes: md 36 px, sm 30 px, xs 28 px. Radius 8 px. Icons 16 px. One primary (teal) per screen.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg-0 hover:bg-[#5EE3D2]',
        secondary: 'bg-bg-2 text-text-1 hover:bg-[#1F2C45]',
        ghost: 'text-text-2 hover:bg-bg-2 hover:text-text-1',
        outline: 'border border-border text-text-1 hover:bg-bg-2',
        destructive: 'bg-risk-red/15 text-risk-red hover:bg-risk-red/25',
        link: 'text-accent underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-[30px] px-3 text-[13px]',
        xs: 'h-7 px-2.5 text-[12px] rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-[30px] w-[30px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
