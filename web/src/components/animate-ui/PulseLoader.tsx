import { motion } from 'framer-motion';

interface PulseLoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export function PulseLoader({ size = 'medium', color = '#e11d2e', text }: PulseLoaderProps) {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };

  const spinnerSize = sizeMap[size];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: `3px solid ${color}33`,
          borderTop: `3px solid ${color}`,
          borderRadius: '50%',
        }}
      />
      {text && (
        <p style={{ margin: 0, color, fontWeight: 600, fontSize: '14px' }}>
          {text}
        </p>
      )}
    </div>
  );
}
