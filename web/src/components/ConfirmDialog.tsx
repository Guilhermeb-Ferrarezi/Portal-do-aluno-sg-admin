import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "./Modal";

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
  confirmText = "Confirmar",
  cancelText = "Cancelar",
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
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl border-border bg-muted text-foreground hover:bg-accent"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            className={
              isDangerous
                ? "h-11 w-full rounded-xl border border-red-500 bg-red-600 text-white hover:bg-red-500"
                : "h-11 w-full rounded-xl border border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
            }
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="inline-flex min-w-0 items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                Processando...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
        {message}
      </p>
    </Modal>
  );
}
