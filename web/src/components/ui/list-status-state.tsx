import * as React from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type ListStatusStateProps = {
  mode: "loading" | "error";
  title?: string;
  description?: string;
  loadingTitle?: string;
  loadingDescription?: string;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  compact?: boolean;
  className?: string;
};

function DefaultListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
      {Array.from({ length: compact ? 2 : 6 }).map((_, index) => (
        <div key={index} className="rounded-[24px] border border-border/70 bg-card/80 p-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="mt-4 h-8 w-3/4 rounded-xl" />
          <Skeleton className="mt-3 h-4 w-full rounded-xl" />
          <Skeleton className="mt-2 h-4 w-2/3 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function ListStatusState({
  mode,
  title,
  description,
  loadingTitle,
  loadingDescription,
  onRetry,
  skeleton,
  compact = false,
  className,
}: ListStatusStateProps) {
  if (mode === "loading") {
    if (skeleton) {
      return <div className={className}>{skeleton}</div>;
    }

    if (loadingTitle || loadingDescription) {
      return (
        <div
          className={cn(
            "grid place-items-center gap-3 rounded-[28px] border border-border/70 bg-card/80 px-6 py-16 text-center shadow-sm",
            className
          )}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              {loadingTitle ?? "Carregando dados..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {loadingDescription ?? "Aguarde enquanto os dados mais recentes sao buscados."}
            </p>
          </div>
        </div>
      );
    }

    return <div className={className}>{<DefaultListSkeleton compact={compact} />}</div>;
  }

  return (
    <EmptyState
      className={className}
      compact={compact}
      icon={<RefreshCcw size={compact ? 16 : 18} />}
      title={title ?? "Nao foi possivel carregar a lista."}
      description={description ?? "Tente novamente para buscar os dados mais recentes."}
      actionLabel={onRetry ? "Tentar novamente" : undefined}
      onAction={onRetry}
    />
  );
}
