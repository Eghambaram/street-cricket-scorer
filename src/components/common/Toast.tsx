import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

// ── Per-type visual config ────────────────────────────────────────────────────

const CONFIG = {
  success: {
    Icon:       CheckCircle2,
    iconClass:  'text-runs',
    barClass:   'bg-runs',
    bg:         'bg-pitch-light border-runs/30',
    duration:   3000,
  },
  error: {
    Icon:       XCircle,
    iconClass:  'text-wicket',
    barClass:   'bg-wicket',
    bg:         'bg-pitch-light border-wicket/35',
    duration:   5000,
  },
  warning: {
    Icon:       AlertTriangle,
    iconClass:  'text-amber',
    barClass:   'bg-amber',
    bg:         'bg-pitch-light border-amber/35',
    duration:   4000,
  },
  info: {
    Icon:       Info,
    iconClass:  'text-four',
    barClass:   'bg-four',
    bg:         'bg-pitch-light border-four/30',
    duration:   3000,
  },
} as const;

// ── Single Toast ──────────────────────────────────────────────────────────────

function Toast({ id, message, type }: { id: string; message: string; type: keyof typeof CONFIG }) {
  const { removeToast } = useUIStore();
  const { Icon, iconClass, barClass, bg, duration } = CONFIG[type];

  return (
    <div
      className={cn(
        'pointer-events-auto w-full rounded-2xl border',
        'shadow-[0_4px_24px_0_rgb(0_0_0/0.25),0_1px_4px_0_rgb(0_0_0/0.15)]',
        'overflow-hidden animate-slide-down',
        bg,
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon size={18} className={cn('shrink-0', iconClass)} strokeWidth={2.5} />
        <p className="flex-1 text-sm font-semibold text-white leading-snug">{message}</p>
        <button
          onClick={() => removeToast(id)}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar — shrinks over the toast lifetime */}
      <div
        className={cn('h-[2px] rounded-b-2xl origin-left', barClass)}
        style={{
          animation: `toastProgress ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
}
