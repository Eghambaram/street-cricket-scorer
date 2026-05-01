import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'gold' | 'wicket' | 'extra' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-pitch-light text-white',
  gold: 'bg-gold text-pitch-dark',
  wicket: 'bg-wicket text-white',
  extra: 'bg-safe text-white',
  muted: 'bg-pitch-dark text-muted',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-2.5 py-0.5 text-sm font-bold min-w-[28px]',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
