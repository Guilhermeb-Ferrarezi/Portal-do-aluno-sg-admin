import type { KeyboardEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
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
  overlayZIndex?: number;
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
  overlayZIndex,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onCancel();
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.target === event.currentTarget) onCancel();
  };

  return createPortal(
    <div
      className="modalOverlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
    >
      <div className="modalContent">
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
            {isLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={16} /> Processando...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
