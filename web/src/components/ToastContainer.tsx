import { AnimatedToast } from './animate-ui';
import { useToastActions, useToasts } from '../contexts/ToastContext';

export function ToastContainer() {
  const toasts = useToasts();
  const { removeToast } = useToastActions();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top))',
        right: 'max(16px, env(safe-area-inset-right))',
        width: 'min(420px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 12000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <AnimatedToast
            message={toast.message}
            type={toast.type}
            duration={0} // Timeout is managed by ToastContext.
            position="inline"
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
