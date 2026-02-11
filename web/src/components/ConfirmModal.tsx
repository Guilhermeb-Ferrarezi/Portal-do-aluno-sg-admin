import { createPortal } from "react-dom";
import "./ConfirmModal.css";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  isLoading?: boolean;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <h3 className="modalTitle">{title}</h3>
        <p className="modalMessage">{message}</p>
        <div className="modalActions">
          <button
            className="modalBtn cancelBtn"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`modalBtn confirmBtn ${danger ? "danger" : ""}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "⏳ Processando..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
