import { useEffect } from 'react';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Prevent closing by clicking backdrop */
  persistent?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, persistent }: ModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop — slightly lighter in light mode so it doesn't clash */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={persistent ? undefined : onClose}
      />
      {/* Sheet */}
      <div
        className={cn(
          'relative w-full max-w-lg bg-pitch-light rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up',
          'max-h-[90dvh] overflow-y-auto',
          /* Top shimmer line for premium glass feel */
          'before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-3xl',
          'before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Handle — muted/30 so it's visible on both dark and light sheets */}
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted/30 mb-4" />
        {title && (
          <h2 className="text-xl font-bold text-white mb-4 text-center">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
