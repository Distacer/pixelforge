import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++counter;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, message }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Короткий доступ поза React-компонентами: toast.success('Збережено') */
export const toast = {
  success: (message: string) => useToasts.getState().push('success', message),
  error: (message: string) => useToasts.getState().push('error', message),
  info: (message: string) => useToasts.getState().push('info', message),
};
