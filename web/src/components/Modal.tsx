import React, { useId } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  size = "md",
  className = "",
}: ModalProps) {
  const titleId = useId();

  const sizeClassName =
    size === "sm"
      ? "max-w-[420px]"
      : size === "lg"
        ? "max-w-[680px]"
        : "max-w-[520px]";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-labelledby={titleId}
        className={cn(
          "max-h-[calc(100vh-24px)] gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:max-h-[calc(100vh-120px)]",
          sizeClassName,
          className
        )}
        onEscapeKeyDown={(event) => {
          if (!closeOnEscape) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!closeOnBackdropClick) event.preventDefault();
        }}
        closeClassName="top-4 right-4 h-10 w-10 rounded-xl bg-muted text-foreground hover:bg-accent focus-visible:ring-ring/50 sm:top-5 sm:right-5"
      >
        <DialogHeader className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <DialogTitle id={titleId} className="pr-12 text-base sm:text-xl">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {footer ? (
          <DialogFooter className="px-4 py-4 sm:px-6 sm:py-5">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
