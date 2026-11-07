import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui "Button", restyled for the MindCode palette.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none border border-transparent [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-ai text-primary-foreground hover:brightness-110',
        approve: 'bg-approved text-[#111] hover:brightness-95',
        secondary: 'bg-raised text-foreground border-hairline hover:bg-accent',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        outline: 'bg-transparent text-foreground border-input hover:bg-accent',
        danger: 'bg-transparent text-unknown border-unknown/40 hover:bg-unknown/10',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-10 px-4 text-sm',
        icon: 'size-8 p-0',
        'icon-sm': 'size-7 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = React.forwardRef(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
