import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
type Size    = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-grass-light border border-grass/60 text-white font-bold hover:brightness-110 active:scale-[0.98] shadow-[0_4px_20px_0_rgb(var(--color-grass-lt)/0.4)]',
  secondary: 'bg-transparent border border-muted/40 text-white hover:bg-pitch-light/70 active:scale-[0.98]',
  danger:    'bg-wicket border border-wicket text-white hover:bg-wicket-dark active:scale-[0.98] shadow-[0_0_12px_0_rgb(var(--color-wicket)/0.3)]',
  ghost:     'bg-transparent border-transparent text-muted hover:text-white hover:bg-pitch-light/50',
  // Always dark text on gold/amber — hardcoded so it works in both light and dark themes
  gold:      'bg-gold border border-gold-dark/30 text-[#1a0e04] font-bold hover:bg-gold-light active:scale-[0.98] shadow-[0_0_16px_0_rgb(var(--color-gold)/0.35)]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-base min-h-[44px]',
  lg: 'px-5 py-3 text-lg min-h-[52px]',
  xl: 'px-6 py-4 text-xl min-h-[60px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 select-none',
        'focus:outline-none focus:ring-2 focus:ring-gold/50',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading
        ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : children}
    </button>
  );
}
