import { useEffect, useState } from 'react';

interface Props {
  onReady: () => void;
}

export function SplashScreen({ onReady }: Props) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Give IndexedDB a moment to initialise, then fade out
    const t = setTimeout(() => {
      setFading(true);
      setTimeout(onReady, 300);
    }, 600);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-pitch flex flex-col items-center justify-center transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgb(13 92 42 / 0.7) 0%, transparent 65%)' }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <span
          className="select-none animate-bounce"
          role="img"
          aria-label="cricket bat"
          style={{ fontSize: '80px', lineHeight: 1 }}
        >
          🏏
        </span>
        <div className="flex flex-col items-center leading-none gap-1">
          <span className="font-display text-5xl tracking-widest shimmer-gold">CRICSCORE</span>
          <span className="text-muted text-xs font-bold uppercase tracking-[0.2em] mt-0.5">Street Cricket Scorer</span>
        </div>
        <p className="text-muted text-xs font-semibold uppercase tracking-widest mt-1">
          Loading…
        </p>
      </div>
    </div>
  );
}
