import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
  position?: 'top-right' | 'inline';
}

export function AnimatedToast({
  message,
  type = 'success',
  duration = 4000,
  onClose,
  position = 'top-right',
}: AnimatedToastProps) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    if (!message || duration <= 0) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const isFloating = position === 'top-right';

  const icon = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
  }[type];
  const wrapperClassName = isFloating
    ? 'fixed right-4 top-4 z-[12000] w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]'
    : 'w-full';
  const toastClassName = {
    success:
      'border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
    error:
      'border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-200',
    info:
      'border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300',
  }[type];

  const initial = isFloating ? { x: 20, opacity: 0 } : { y: -20, opacity: 0 };
  const animate = isFloating ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 };
  const exit = isFloating ? { x: 20, opacity: 0 } : { y: -20, opacity: 0 };

  const content = (
    <AnimatePresence>
      {message && (
        <m.div
          key="toast"
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          className={wrapperClassName}
        >
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 shadow-lg backdrop-blur',
              toastClassName
            )}
          >
            <span className="inline-flex shrink-0">{icon}</span>
            <span className="min-w-0 flex-1 break-words">{message}</span>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );

  if (isFloating && portalReady && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
