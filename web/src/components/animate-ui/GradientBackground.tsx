import React from 'react';

interface GradientBackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

export function GradientBackground({
  children,
  className = '',
}: GradientBackgroundProps) {
  return (
    <div className={`gradient-background ${className}`}>
      {children}
      <style>{`
        .gradient-background {
          position: relative;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            -45deg,
            rgba(225, 29, 46, 0.1),
            rgba(59, 130, 246, 0.1),
            rgba(168, 85, 247, 0.1)
          );
          background-size: 400% 400%;
          animation: gradient-shift 15s ease infinite;
          overflow: hidden;
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .gradient-background::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(
            circle,
            rgba(225, 29, 46, 0.1) 0%,
            transparent 70%
          );
          animation: float 20s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(30px, 30px);
          }
        }
      `}</style>
    </div>
  );
}
