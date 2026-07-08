import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold font-mono tabular-nums',
  {
    variants: {
      variant: {
        default:  'border-zinc-700 text-zinc-400',
        perfect:  'border-emerald-500 text-emerald-400',
        good:     'border-amber-500 text-amber-400',
        low:      'border-zinc-700 text-zinc-500',
        outline:  'border-zinc-800 text-zinc-300',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
