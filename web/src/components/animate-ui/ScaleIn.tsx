import React from 'react';

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function ScaleIn({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
}: ScaleInProps) {
  return (
    <div className={`scale-in ${className}`} style={{
      '--scale-delay': `${delay}s`,
      '--scale-duration': `${duration}s`,
    } as React.CSSProperties}>
      {children}
      <style>{`
        .scale-in {
          animation: scaleIn var(--scale-duration) cubic-bezier(0.34, 1.56, 0.64, 1) var(--scale-delay) forwards;
          transform-origin: center;
          opacity: 0;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
