
interface FlipButtonProps {
  front: string;
  back: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function FlipButton({
  front,
  back,
  onClick,
  className = '',
  disabled = false,
}: FlipButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flip-button ${className}`}
    >
      <div className="flip-button-inner">
        <div className="flip-button-front">{front}</div>
        <div className="flip-button-back">{back}</div>
      </div>
      <style>{`
        .flip-button {
          position: relative;
          width: 120px;
          height: 40px;
          border: none;
          border-radius: 8px;
          background: var(--primary);
          color: white;
          font-weight: 600;
          cursor: pointer;
          perspective: 1000px;
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .flip-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(225, 29, 46, 0.3);
        }

        .flip-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .flip-button-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }

        .flip-button:hover .flip-button-inner {
          transform: rotateY(180deg);
        }

        .flip-button-front,
        .flip-button-back {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          backface-visibility: hidden;
        }

        .flip-button-back {
          transform: rotateY(180deg);
        }
      `}</style>
    </button>
  );
}
