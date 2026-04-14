import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-11 w-full min-w-0 rounded-[1rem] border border-input bg-[var(--input-bg)] px-3.5 py-2 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[border-color,background-color,box-shadow,transform] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-[var(--input-bg-focus)] focus-visible:ring-4 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
