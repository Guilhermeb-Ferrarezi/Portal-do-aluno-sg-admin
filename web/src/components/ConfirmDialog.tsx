import Modal from './Modal';
import { AnimatedButton } from './animate-ui';
import { Loader2 } from 'lucide-react';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isDangerous?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isLoading = false,
  isDangerous = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="confirm-dialog-actions">
          <AnimatedButton
            className="btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </AnimatedButton>
          <AnimatedButton
            className={`btn-confirm ${isDangerous ? 'btn-danger' : ''}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={16} /> Processando...
              </span>
            ) : (
              confirmText
            )}
          </AnimatedButton>
        </div>
      }
    >
      <p className="confirm-dialog-message">{message}</p>
    </Modal>
  );
}
