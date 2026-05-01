import { ChevronLeft, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface TopBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  /** Show the dark/light theme toggle. Only used on root tab pages. */
  showThemeToggle?: boolean;
}

export function TopBar({ title, subtitle, showBack, onBack, actions, showThemeToggle = false }: TopBarProps) {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="
      sticky top-0 z-30
      flex items-center gap-3 px-4 py-3
      glass border-b border-white/[0.06]
      shadow-[0_1px_0_0_rgb(255_255_255/0.04),0_2px_8px_0_rgb(0_0_0/0.3)]
      min-h-[56px]
    ">
      {showBack && (
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-9 h-9 -ml-1.5 rounded-xl text-muted hover:text-white hover:bg-pitch-light/60 transition-all"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-white tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted truncate mt-px">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        {showThemeToggle && (
          <button
            onClick={toggle}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-gold hover:bg-pitch-light/60 transition-all"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}
      </div>
    </header>
  );
}
