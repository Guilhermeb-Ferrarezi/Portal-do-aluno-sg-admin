import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onCancel();
      }}
      role="presentation"
      style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-[0_18px_56px_rgba(0,0,0,0.28)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h3
          id="confirm-modal-title"
          className="m-0 text-lg font-extrabold leading-tight tracking-[-0.02em] text-foreground"
        >
          {title}
        </h3>
        <p className="mt-3 mb-0 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {message}
        </p>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-border bg-muted text-foreground hover:bg-accent"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            className={
              danger
                ? "h-11 rounded-xl border border-red-500 bg-red-600 text-white hover:bg-red-500"
                : "h-11 rounded-xl border border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
            }
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                Processando...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
