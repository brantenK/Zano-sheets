import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: ToastType, message: string, duration: number = 5000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, type, message, duration };
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const toastContext = useContext(ToastContext);
  if (!toastContext) return null;

  const { toasts, dismissToast } = toastContext;

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      style={{ fontFamily: "var(--chat-font-mono)" }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 text-xs rounded shadow-lg
            border animate-slide-in min-w-[300px] max-w-[500px]
            ${
              toast.type === "success"
                ? "bg-(--chat-bg) border-(--chat-success) text-(--chat-success)"
                : toast.type === "error"
                  ? "bg-(--chat-bg) border-(--chat-error) text-(--chat-error)"
                  : toast.type === "warning"
                    ? "bg-(--chat-bg) border-amber-500 text-amber-500"
                    : "bg-(--chat-bg) border-(--chat-accent) text-(--chat-accent)"
            }
          `}
          style={{ borderRadius: "var(--chat-radius)" }}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
