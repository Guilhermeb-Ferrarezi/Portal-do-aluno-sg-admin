import React from 'react';
import { m } from 'framer-motion';

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

const EMPTY_STYLE: React.CSSProperties = {};

export function AnimatedButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  style = EMPTY_STYLE,
  type = 'button',
  title,
}: AnimatedButtonProps) {
  return (
    <m.button
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
        <m.div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <m.span
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
        </m.div>
      ) : (
        children
      )}
    </m.button>
  );
}
