import React from 'react';

interface PulseLoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export function PulseLoader({
  size = 'medium',
  color = 'var(--red)',
  text = 'Carregando...',
}: PulseLoaderProps) {
  const sizes = {
    small: '30px',
    medium: '50px',
    large: '70px',
  };

  return (
    <div className="pulse-loader-container">
      <div className="pulse-loader" style={{
        '--pulse-color': color,
        '--pulse-size': sizes[size],
      } as React.CSSProperties} />
      {text && <p className="pulse-text">{text}</p>}

      <style>{`
        .pulse-loader-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px;
        }

        .pulse-loader {
          width: var(--pulse-size);
          height: var(--pulse-size);
          border-radius: 50%;
          background: var(--pulse-color);
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 0 0 var(--pulse-color);
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(var(--pulse-color), 0.7);
          }
          50% {
            box-shadow: 0 0 0 20px rgba(var(--pulse-color), 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(var(--pulse-color), 0);
          }
        }

        .pulse-text {
          color: var(--text);
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
