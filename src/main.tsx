import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-expect-error — virtual module injected by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { seedDefaultData } from '@/db/seed';

seedDefaultData();

// PWA service worker registration with update prompt
registerSW({
  onNeedRefresh() {
    if (confirm('New version available! Reload to update?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
