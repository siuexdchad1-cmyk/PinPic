import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

/**
 * CSS border-spin spinner — no JS animation, hardware-accelerated rotation.
 * Safe for all legacy WebViews. No transform scale — only border-color trick.
 */
export default function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading…',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  };

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex items-center justify-center', className)}
    >
      <div
        className={cn(
          'rounded-full border-zinc-800 border-t-emerald-500 animate-spin',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
