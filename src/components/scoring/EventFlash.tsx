import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

export function EventFlash() {
  const { boundaryFlash, wicketFlash } = useUIStore();
  const active = wicketFlash ? 'wicket' : boundaryFlash;
  if (!active) return null;

  return (
    // key forces re-mount on every new event, restarting animations cleanly
    <div
      key={active}
      className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
    >
      {/* Neutral dark scrim — works equally in light and dark mode */}
      <div className="absolute inset-0 bg-black/50 animate-overlay-scrim" />

      {/* Centered event card */}
      <div className="relative animate-overlay-text flex flex-col items-center gap-3 px-10 py-8 rounded-3xl">
        {active === 'wicket' && (
          <>
            {/* Stumps icon */}
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_16px_rgb(var(--color-wicket)/0.8)]">
              {/* Three stumps */}
              <rect x="18" y="22" width="6" height="42" rx="3" fill="rgb(var(--color-wicket))"/>
              <rect x="33" y="22" width="6" height="42" rx="3" fill="rgb(var(--color-wicket))"/>
              <rect x="48" y="22" width="6" height="42" rx="3" fill="rgb(var(--color-wicket))"/>
              {/* Bails — left bail knocked off at an angle */}
              <rect x="16" y="18" width="18" height="5" rx="2.5" fill="rgb(var(--color-wicket)/0.9)" transform="rotate(-18 16 18)"/>
              {/* Right bail still on */}
              <rect x="38" y="16" width="18" height="5" rx="2.5" fill="rgb(var(--color-wicket)/0.9)"/>
            </svg>
            <p
              className={cn(
                'font-display text-[80px] leading-none tracking-[6px]',
                'text-wicket',
                // strong glow readable on both light and dark backgrounds
                'drop-shadow-[0_0_32px_rgb(var(--color-wicket)/0.9)]',
                '[text-shadow:0_0_40px_rgb(var(--color-wicket)/0.8),0_0_80px_rgb(var(--color-wicket)/0.5)]',
              )}
            >
              WICKET!
            </p>
          </>
        )}
        {active === 'four' && (
          <>
            <span className="text-6xl leading-none">🏏</span>
            <p
              className={cn(
                'font-display text-[80px] leading-none tracking-[6px]',
                'text-four',
                '[text-shadow:0_0_40px_rgb(var(--color-four)/0.9),0_0_80px_rgb(var(--color-four)/0.5)]',
              )}
            >
              FOUR!
            </p>
          </>
        )}
        {active === 'six' && (
          <>
            <span className="text-6xl leading-none">💥</span>
            <p
              className={cn(
                'font-display text-[96px] leading-none tracking-[8px]',
                'text-six',
                '[text-shadow:0_0_50px_rgb(var(--color-six)/1),0_0_100px_rgb(var(--color-six)/0.6)]',
              )}
            >
              SIX!
            </p>
          </>
        )}
      </div>
    </div>
  );
}
