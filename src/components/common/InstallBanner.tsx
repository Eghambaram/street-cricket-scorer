import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from './Button';
import { Modal } from './Modal';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

// Detect iOS Safari (not Chrome/Firefox on iOS — those can't install PWAs)
function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  // Safari on iOS does NOT set Chrome/CriOS/FxiOS
  const isSafariOnIOS = isIOS && !/crios|fxios|opios/i.test(ua);
  return isSafariOnIOS;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

const DISMISSED_KEY = 'pwa-install-dismissed';

export function InstallBanner() {
  const { canInstall, triggerInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) setDismissed(true);
    setIsIOS(isIOSSafari() && !isStandalone());
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const showBanner = !dismissed && (canInstall || isIOS);
  if (!showBanner) return null;

  return (
    <>
      <div className="flex items-center gap-3 bg-pitch-dark border-t border-pitch-light px-4 py-3">
        <Download size={20} className="text-gold shrink-0" />
        <p className="flex-1 text-sm text-white">
          Add to Home Screen for the best offline experience
        </p>
        {isIOS ? (
          <Button variant="gold" size="sm" onClick={() => setShowIOSGuide(true)}>
            How?
          </Button>
        ) : (
          <Button variant="gold" size="sm" onClick={triggerInstall}>
            Install
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="text-muted hover:text-white p-1"
          aria-label="Dismiss install banner"
        >
          <X size={18} />
        </button>
      </div>

      {/* iOS step-by-step guide */}
      <Modal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} title="Add to Home Screen">
        <p className="text-muted text-sm mb-5 text-center">
          Install CricScore on your iPhone or iPad for the full offline experience.
        </p>

        <div className="space-y-4">
          <Step n={1} icon={<Share size={20} className="text-[#1a9fff]" />}>
            Tap the <span className="text-white font-semibold">Share</span> button at the bottom of Safari (the box with an arrow pointing up).
          </Step>

          <Step n={2} icon={<PlusSquare size={20} className="text-[#1a9fff]" />}>
            Scroll down and tap <span className="text-white font-semibold">"Add to Home Screen"</span>.
          </Step>

          <Step n={3} icon={<Download size={20} className="text-gold" />}>
            Tap <span className="text-white font-semibold">"Add"</span> in the top-right corner. The app will appear on your home screen.
          </Step>
        </div>

        <div className="mt-6">
          <Button variant="gold" fullWidth onClick={() => { setShowIOSGuide(false); handleDismiss(); }}>
            Got it!
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-pitch-dark border border-pitch-light flex items-center justify-center text-xs font-black text-gold">
        {n}
      </div>
      <div className="flex items-start gap-2 flex-1">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <p className="text-sm text-muted leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
