import React from 'react';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeInUp({
  children,
  delay = 0,
  duration = 0.6,
  className = '',
}: FadeInUpProps) {
  return (
    <div className={`fade-in-up ${className}`} style={{
      '--fade-in-delay': `${delay}s`,
      '--fade-in-duration': `${duration}s`,
    } as React.CSSProperties}>
      {children}
      <style>{`
        .fade-in-up {
          animation: fadeInUp var(--fade-in-duration) ease-out var(--fade-in-delay) forwards;
          opacity: 0;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
