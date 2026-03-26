import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
        />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_56px_rgba(0,0,0,0.28)] outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4"
          style={overlayZIndex ? { zIndex: overlayZIndex + 1 } : undefined}
        >
          <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4 text-left">
            <DialogPrimitive.Title
              id="confirm-modal-title"
              className="pr-12 text-lg font-extrabold leading-tight tracking-[-0.02em] text-foreground"
            >
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
              {message}
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end">
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
              variant={danger ? "destructive" : "default"}
              className={cn(
                "h-11 rounded-xl px-4",
                danger && "border border-destructive/25 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
