import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConditionalFieldAnimationProps {
  children: React.ReactNode;
  isVisible: boolean;
  duration?: number;
}

export function ConditionalFieldAnimation({
  children,
  isVisible,
  duration = 0.22,
}: ConditionalFieldAnimationProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="conditional-field"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{
            duration,
            ease: [0.4, 0, 0.2, 1], // material-motion easing
          }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
