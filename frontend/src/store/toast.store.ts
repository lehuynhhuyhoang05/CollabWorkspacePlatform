import { create } from "zustand";

export type ToastKind = "success" | "info" | "error";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  kind: ToastKind;
}

interface PushToastInput {
  title?: string;
  message: string;
  kind?: ToastKind;
  durationMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (input: PushToastInput) => string;
  dismissToast: (id: string) => void;
}

const DEFAULT_DURATION_MS = 3200;

function createToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (input) => {
    const id = createToastId();
    const toast: ToastItem = {
      id,
      title: input.title,
      message: input.message,
      kind: input.kind ?? "info",
    };

    set((state) => ({
      toasts: [...state.toasts, toast].slice(-5),
    }));

    const timeoutMs = input.durationMs ?? DEFAULT_DURATION_MS;
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id),
        }));
      }, timeoutMs);
    }

    return id;
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    }));
  },
}));
