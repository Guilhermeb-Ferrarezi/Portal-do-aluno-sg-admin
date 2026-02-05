import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

export function AnimatedToast({
  message,
  type = 'success',
  duration = 4000,
  onClose,
}: AnimatedToastProps) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

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
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  }[type];

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="toast"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            right: '24px',
            maxWidth: '500px',
            zIndex: 9999,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              border: `1px solid ${borderColor}`,
              background: backgroundColor,
              color: textColor,
              padding: '14px 18px',
              textAlign: 'center',
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
            <span style={{ flexShrink: 0, fontSize: '16px' }}>{icon}</span>
            <span style={{ flex: 1 }}>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
