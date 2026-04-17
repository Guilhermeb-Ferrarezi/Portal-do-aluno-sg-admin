import * as React from "react";
import { Link } from "react-router-dom";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconActionProps = Omit<React.ComponentProps<"button">, "children" | "aria-label" | "title"> &
  VariantProps<typeof buttonVariants> & {
    label: string;
    icon: React.ReactNode;
    to?: string;
    href?: string;
    tooltipSide?: "top" | "bottom";
    tooltipClassName?: string;
  };

export function IconAction({
  label,
  icon,
  to,
  href,
  variant = "ghost",
  size = "icon-sm",
  className,
  tooltipSide = "top",
  tooltipClassName,
  ...props
}: IconActionProps) {
  const tooltipPositionClass =
    tooltipSide === "bottom"
      ? "top-[calc(100%+0.45rem)]"
      : "bottom-[calc(100%+0.45rem)]";

  const sharedProps = {
    "aria-label": label,
    title: label,
    variant,
    size,
    className,
  } as const;

  return (
    <span className="group/icon-action relative inline-flex shrink-0">
      {to ? (
        <Button asChild {...sharedProps}>
          <Link to={to}>{icon}</Link>
        </Button>
      ) : href ? (
        <Button asChild {...sharedProps}>
          <a href={href} target="_blank" rel="noreferrer">
            {icon}
          </a>
        </Button>
      ) : (
        <Button type="button" {...sharedProps} {...props}>
          {icon}
        </Button>
      )}

      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-[120] hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-semibold text-popover-foreground shadow-lg group-hover/icon-action:inline-flex group-focus-within/icon-action:inline-flex",
          tooltipPositionClass,
          tooltipClassName
        )}
      >
        {label}
      </span>
    </span>
  );
}
