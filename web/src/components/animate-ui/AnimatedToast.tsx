import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';

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
  useEffect(() => {
    if (!message || duration <= 0) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const isFloating = position === 'top-right';

  const backgroundColor = {
    success: 'rgba(34, 197, 94, 0.12)',
    error: 'rgba(225, 29, 72, 0.12)',
    info: 'rgba(59, 130, 246, 0.12)',
  }[type];

  const borderColor = {
    success: 'rgba(34, 197, 94, 0.4)',
    error: 'rgba(225, 29, 72, 0.35)',
    info: 'rgba(59, 130, 246, 0.3)',
  }[type];

  const textColor = {
    success: '#16a34a',
    error: '#ffd1d1',
    info: '#1e40af',
  }[type];

  const icon = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
  }[type];

  const wrapperStyle: CSSProperties = isFloating
    ? {
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        right: 'max(16px, env(safe-area-inset-right))',
        width: 'min(420px, calc(100vw - 32px))',
        boxSizing: 'border-box',
        zIndex: 12000,
      }
    : {
        width: '100%',
        boxSizing: 'border-box',
      };

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
          style={wrapperStyle}
        >
          <div
            style={{
              border: `1px solid ${borderColor}`,
              background: backgroundColor,
              color: textColor,
              padding: '14px 18px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backdropFilter: 'blur(8px)',
              wordWrap: 'break-word',
              whiteSpace: 'normal',
              lineHeight: '1.4',
            }}
          >
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>
            <span style={{ flex: 1 }}>{message}</span>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );

  if (isFloating && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
