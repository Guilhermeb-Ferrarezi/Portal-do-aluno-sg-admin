/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;
}

type ToastActionsContextType = Pick<ToastContextType, "addToast" | "removeToast">;

const ToastStateContext = createContext<Toast[] | undefined>(undefined);
const ToastActionsContext = createContext<ToastActionsContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutByToastIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timeoutByToastId = timeoutByToastIdRef.current;
    return () => {
      timeoutByToastId.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutByToastId.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const timeoutId = timeoutByToastIdRef.current.get(id);
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      timeoutByToastIdRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11);
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    // Auto-remove after duration
    if (duration > 0) {
      const timeoutId = window.setTimeout(() => {
        timeoutByToastIdRef.current.delete(id);
        removeToast(id);
      }, duration);
      timeoutByToastIdRef.current.set(id, timeoutId);
    }
  }, [removeToast]);

  const actionsValue = useMemo<ToastActionsContextType>(
    () => ({ addToast, removeToast }),
    [addToast, removeToast]
  );

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastStateContext.Provider value={toasts}>
        {children}
      </ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  );
}

export function useToasts() {
  const context = useContext(ToastStateContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider');
  }
  return context;
}

export function useToastActions() {
  const context = useContext(ToastActionsContext);
  if (!context) {
    throw new Error('useToastActions deve ser usado dentro de ToastProvider');
  }
  return context;
}

// Mantido por compatibilidade com código existente.
export function useToast() {
  const toasts = useToasts();
  const actions = useToastActions();
  return useMemo(() => ({ toasts, ...actions }), [toasts, actions]);
}
