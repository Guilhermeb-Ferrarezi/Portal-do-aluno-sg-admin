import React from 'react';

interface PopInBadgeProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PopInBadge({
  children,
  delay = 0,
  className = '',
  style = {},
}: PopInBadgeProps) {
  return (
    <span
      className={`pop-in-badge ${className}`}
      style={{
        '--pop-delay': `${delay}s`,
        ...style,
      } as React.CSSProperties}
    >
      {children}
      <style>{`
        .pop-in-badge {
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--pop-delay) forwards;
          transform-origin: center;
          display: inline-block;
          opacity: 0;
        }

        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0) rotate(-180deg);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </span>
  );
}
