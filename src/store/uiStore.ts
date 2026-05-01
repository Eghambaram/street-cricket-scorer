import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UIState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  boundaryFlash: 'four' | 'six' | null;
  wicketFlash: boolean;
  scoreFlash: number; // increments on every legal delivery — triggers CSS pulse
  triggerBoundaryFlash: (type: 'four' | 'six') => void;
  triggerWicketFlash: () => void;
  triggerScoreFlash: () => void;
  clearFlash: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    const duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  boundaryFlash: null,
  wicketFlash: false,
  scoreFlash: 0,
  triggerScoreFlash: () => set((s) => ({ scoreFlash: s.scoreFlash + 1 })),
  triggerBoundaryFlash: (type) => {
    set({ boundaryFlash: type });
    const duration = type === 'six' ? 1100 : 850;
    setTimeout(() => set({ boundaryFlash: null }), duration);
  },
  triggerWicketFlash: () => {
    // Wicket takes priority — cancel any in-flight boundary flash immediately
    set({ wicketFlash: true, boundaryFlash: null });
    if (navigator.vibrate) navigator.vibrate([100, 60, 180]);
    setTimeout(() => set({ wicketFlash: false }), 750);
  },
  clearFlash: () => set({ boundaryFlash: null, wicketFlash: false }),
}));
