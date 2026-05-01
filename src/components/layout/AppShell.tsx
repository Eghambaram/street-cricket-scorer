import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { InstallBanner } from '@/components/common/InstallBanner';
import { ToastContainer } from '@/components/common/Toast';
import { useTheme } from '@/hooks/useTheme';

const FULL_SCREEN_ROUTES = ['/match'];

// Landscape guard — overlays the app with a rotate prompt when in landscape
function PortraitGuard() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    setIsLandscape(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Only block on touch devices — desktop users legitimately use landscape
  if (!isLandscape || navigator.maxTouchPoints === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-pitch flex flex-col items-center justify-center p-8 text-center">
      <span className="text-6xl mb-4 select-none">📱</span>
      <p className="text-white font-black text-xl mb-2">Rotate your phone</p>
      <p className="text-muted text-sm">Street Cricket Scorer works best in portrait mode</p>
    </div>
  );
}

export function AppShell() {
  useTheme(); // initialises theme class on <html> on mount

  const location = useLocation();
  const isFullScreen = FULL_SCREEN_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="relative flex flex-col min-h-[100dvh] bg-pitch text-white">
      <PortraitGuard />
      <OfflineBanner />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {!isFullScreen && (
        <>
          <InstallBanner />
          <BottomNav />
        </>
      )}
      <ToastContainer />
    </div>
  );
}
