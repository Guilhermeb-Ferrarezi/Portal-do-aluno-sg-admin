import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedSelectProps {
  className?: string;
  value: string | string[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
  multiple?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

export function AnimatedSelect({
  className = '',
  value,
  onChange,
  children,
  disabled = false,
  multiple = false,
  size,
  style = {},
}: AnimatedSelectProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      style={{ position: 'relative', ...style }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      animate={isFocused ? { scale: 1.02 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <select
        className={className}
        value={value}
        onChange={onChange}
        disabled={disabled}
        multiple={multiple}
        size={size}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          filter: isFocused ? 'drop-shadow(0 0 8px rgba(225, 29, 46, 0.2))' : 'none',
        }}
      >
        {children}
      </select>

      {/* Pseudo-animation indicator */}
      {isFocused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            bottom: -2,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, var(--red), transparent)',
            borderRadius: '1px',
          }}
        />
      )}
    </motion.div>
  );
}
