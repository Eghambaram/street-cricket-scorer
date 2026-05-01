import { useOffline } from '@/hooks/useOffline';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const isOffline = useOffline();
  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    if (!isOffline) {
      setShowOnline(true);
      const t = setTimeout(() => setShowOnline(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOffline]);

  if (!isOffline && !showOnline) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-center justify-center transition-colors ${
        isOffline ? 'bg-amber text-pitch-dark font-bold' : 'bg-runs-dark text-white'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} />
          You're offline — scores are saved locally
        </>
      ) : (
        <>
          <Wifi size={14} />
          Back online
        </>
      )}
    </div>
  );
}
