import React from 'react';

interface AnimatedRadioLabelProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  icon?: string;
  className?: string;
}

export function AnimatedRadioLabel({
  name,
  value,
  checked,
  onChange,
  label,
  icon = '',
  className = '',
}: AnimatedRadioLabelProps) {
  return (
    <label
      className={`animated-radio-label ${checked ? 'checked' : ''} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        padding: '12px 16px',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
        border: `2px solid ${checked ? 'var(--red)' : 'var(--line)'}`,
        backgroundColor: checked ? 'rgba(225, 29, 46, 0.05)' : 'transparent',
        color: checked ? 'var(--red)' : 'var(--text)',
        fontWeight: checked ? '600' : '500',
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        style={{
          cursor: 'pointer',
          width: '18px',
          height: '18px',
          accentColor: 'var(--red)',
        }}
      />
      <span>
        {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
        {label}
      </span>

      <style>{`
        .animated-radio-label {
          position: relative;
          overflow: hidden;
        }

        .animated-radio-label input[type="radio"] {
          animation: radioCheck 0.4s ease;
        }

        .animated-radio-label.checked {
          animation: selectRadio 0.3s ease;
        }

        @keyframes radioCheck {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes selectRadio {
          0% {
            transform: translateX(-5px);
          }
          50% {
            transform: translateX(3px);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animated-radio-label::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 0;
          height: 0;
          background: rgba(225, 29, 46, 0.1);
          border-radius: 50%;
          transition: width 0.4s, height 0.4s;
          pointer-events: none;
        }

        .animated-radio-label.checked::before {
          width: 100%;
          height: 100%;
          animation: radioPulse 0.6s ease-out;
        }

        @keyframes radioPulse {
          0% {
            width: 0;
            height: 0;
          }
          100% {
            width: 100%;
            height: 100%;
          }
        }
      `}</style>
    </label>
  );
}
