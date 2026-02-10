import React, { useRef } from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function RippleButton({
  children,
  className = '',
  onClick,
  ...props
}: RippleButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.className = 'ripple';

    button.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);

    onClick?.(e);
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={`ripple-button ${className}`}
      {...props}
    >
      {children}
      <style>{`
        .ripple-button {
          position: relative;
          overflow: hidden;
          isolation: isolate; /* Create stacking context */
        }

        .ripple {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.4);
          transform: scale(0);
          animation: ripple-animation 0.6s ease-out;
          pointer-events: none;
          z-index: 10;
        }

        @keyframes ripple-animation {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
}
