import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export function AnimatedButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  style = {},
  type = 'button',
  title,
}: AnimatedButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={style}
      title={title}
      whileHover={!disabled && !loading ? { y: -2, boxShadow: '0 6px 20px rgba(225, 29, 46, 0.3)' } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {loading ? (
        <motion.div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
            }}
          />
          {children}
        </motion.div>
      ) : (
        children
      )}
    </motion.button>
  );
}
