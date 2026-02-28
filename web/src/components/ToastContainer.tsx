import { AnimatedToast } from './animate-ui';
import { useToastActions, useToasts } from '../contexts/ToastContext';

export function ToastContainer() {
  const toasts = useToasts();
  const { removeToast } = useToastActions();

  return (
    <>
      {toasts.map((toast) => (
        <div key={toast.id}>
          <AnimatedToast
            message={toast.message}
            type={toast.type}
            duration={0} // Já é gerenciado pelo contexto
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
}
