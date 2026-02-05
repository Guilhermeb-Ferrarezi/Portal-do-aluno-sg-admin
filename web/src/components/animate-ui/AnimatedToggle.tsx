import React from "react";
import { motion } from "framer-motion";

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
  // Check for prefers-reduced-motion
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animationDuration = prefersReduced ? 0.05 : 0.2;

  return (
    <label
      className={`animated-switch ${className || ""}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: "48px",
        height: "28px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      title={title}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{
          opacity: 0,
          width: 0,
          height: 0,
          position: "absolute",
        }}
      />

      <motion.div
        className="slider"
        style={{
          position: "absolute",
          cursor: disabled ? "not-allowed" : "pointer",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "999px",
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
        animate={{
          backgroundColor: checked
            ? "rgba(225, 29, 46, 0.2)"
            : "var(--background-hover)",
          borderColor: checked ? "var(--red)" : "var(--line)",
        }}
        transition={{
          duration: animationDuration,
          ease: "easeInOut",
        }}
      >
        {/* Animated circle */}
        <motion.div
          className="slider-thumb"
          style={{
            position: "absolute",
            height: "22px",
            width: "22px",
            top: "2px",
            borderRadius: "50%",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
          }}
          animate={{
            left: checked ? "24px" : "2px",
            backgroundColor: checked ? "var(--red)" : "var(--background)",
          }}
          transition={{
            duration: animationDuration,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </label>
  );
};
