import React from "react";
import { m } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface AnimatedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  className,
  id,
  title,
  "aria-label": ariaLabel,
}) => {
  const prefersReduced = usePrefersReducedMotion();
  const animationDuration = prefersReduced ? 0.05 : 0.2;
  const [isFocusVisible, setIsFocusVisible] = React.useState(false);

  const trackStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    width: 52,
    height: 30,
    padding: 3,
    borderRadius: 999,
    border: "1px solid",
    overflow: "hidden",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    appearance: "none",
    WebkitAppearance: "none",
    WebkitTapHighlightColor: "transparent",
    background: "transparent",
    outline: "none",
    boxShadow: isFocusVisible ? "var(--focus-ring)" : "none",
  };

  const thumbStyle: React.CSSProperties = {
    position: "absolute",
    top: 3,
    left: 3,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: checked ? "var(--primary)" : "var(--background)",
    boxShadow: checked
      ? "0 8px 18px rgba(var(--primary-rgb), 0.28), 0 2px 6px rgba(0, 0, 0, 0.14)"
      : "0 6px 14px rgba(15, 23, 42, 0.14), 0 2px 4px rgba(15, 23, 42, 0.08)",
  };

  return (
    <m.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={className}
      style={trackStyle}
      title={title}
      id={id}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      onFocus={(e) => {
        setIsFocusVisible(e.currentTarget.matches(":focus-visible"));
      }}
      onBlur={() => {
        setIsFocusVisible(false);
      }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
    >
      <m.div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          border: "1px solid transparent",
        }}
        initial={false}
        animate={{
          backgroundColor: checked
            ? "rgba(var(--primary-rgb), 0.18)"
            : "color-mix(in srgb, var(--background-hover) 88%, var(--background) 12%)",
          borderColor: checked
            ? "color-mix(in srgb, var(--primary) 68%, var(--line))"
            : "color-mix(in srgb, var(--line-strong) 78%, transparent)",
          boxShadow: checked
            ? "inset 0 0 0 1px rgba(var(--primary-rgb), 0.08), inset 0 10px 24px rgba(var(--primary-rgb), 0.08)"
            : "inset 0 1px 2px rgba(15, 23, 42, 0.06)",
        }}
        transition={{
          duration: animationDuration,
          ease: "easeInOut",
        }}
      />

      <m.div
        aria-hidden="true"
        style={thumbStyle}
        initial={false}
        animate={{
          x: checked ? 22 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 640,
          damping: 34,
          mass: 0.85,
          duration: animationDuration,
        }}
      />
    </m.button>
  );
};
