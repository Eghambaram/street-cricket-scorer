import { cn } from '@/utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-block w-6 h-6 border-2 border-muted border-t-gold rounded-full animate-spin',
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
