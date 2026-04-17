import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  compact?: boolean;
  className?: string;
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  compact = false,
  className,
}: EmptyStateProps) {
  const containerClassName = cn(
    "flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-muted/20 px-6 text-center shadow-sm",
    compact ? "min-h-0 gap-2 py-6" : "min-h-40 gap-3 py-10",
    className
  );

  const iconWrapClassName = cn(
    "inline-flex items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground",
    compact ? "size-10" : "size-12"
  );

  const action = actionLabel ? (
    actionHref ? (
      isExternalHref(actionHref) ? (
        <Button asChild className="mt-2 rounded-full px-4">
          <a href={actionHref} target="_blank" rel="noreferrer">
            {actionLabel}
          </a>
        </Button>
      ) : (
        <Button asChild className="mt-2 rounded-full px-4">
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      )
    ) : onAction ? (
      <Button type="button" className="mt-2 rounded-full px-4" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null
  ) : null;

  return (
    <div className={containerClassName}>
      <div className={iconWrapClassName} aria-hidden="true">
        {icon}
      </div>
      <div className="space-y-1.5">
        <p className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>
          {title}
        </p>
        <p className={cn("mx-auto max-w-2xl leading-6 text-muted-foreground", compact ? "text-sm" : "text-sm")}>
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
