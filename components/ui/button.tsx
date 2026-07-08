import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-emerald-500 text-black hover:bg-emerald-600 active:bg-emerald-700',
        outline:
          'border border-zinc-800 bg-transparent text-white hover:bg-zinc-900 active:bg-zinc-800',
        ghost:
          'bg-transparent text-white hover:bg-zinc-900 active:bg-zinc-800',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
        amber:
          'bg-amber-500 text-black hover:bg-amber-600 active:bg-amber-700',
        link:
          'text-emerald-400 underline-offset-4 hover:underline bg-transparent p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-12 px-6 text-base',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
