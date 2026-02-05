import React from 'react';

type Direction = 'left' | 'right' | 'top' | 'bottom';

interface SlideInProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideIn({
  children,
  direction = 'left',
  delay = 0,
  duration = 0.5,
  className = '',
}: SlideInProps) {
  const getTransform = () => {
    switch (direction) {
      case 'left': return 'translateX(-30px)';
      case 'right': return 'translateX(30px)';
      case 'top': return 'translateY(-30px)';
      case 'bottom': return 'translateY(30px)';
    }
  };

  return (
    <div className={`slide-in slide-in-${direction} ${className}`} style={{
      '--slide-delay': `${delay}s`,
      '--slide-duration': `${duration}s`,
      '--slide-transform': getTransform(),
    } as React.CSSProperties}>
      {children}
      <style>{`
        .slide-in {
          animation: slideIn var(--slide-duration) ease-out var(--slide-delay) forwards;
          opacity: 0;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: var(--slide-transform);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
