import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-expect-error — virtual module injected by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { seedDefaultData } from '@/db/seed';

seedDefaultData();

// PWA service worker registration with update prompt.
// A plain window.location.reload() does NOT switch versions: the new service
// worker stays "waiting" and the old cached build keeps being served. updateSW(true)
// tells the waiting worker to take over and then reloads the page. Match data
// lives in IndexedDB and is written after every ball, so reloading loses nothing.
const updateSW: (reloadPage?: boolean) => Promise<void> = registerSW({
  onNeedRefresh() {
    if (confirm('New version available! Reload to update?')) {
      void updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  // An installed PWA can stay open for days, so ask the server for a new build
  // every hour and whenever the app comes back to the foreground.
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (navigator.onLine) registration.update().catch(() => { /* offline or server unreachable */ });
    };
    setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
