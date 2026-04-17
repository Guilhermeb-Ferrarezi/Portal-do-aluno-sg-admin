import React from 'react';
import { m } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

interface StaggerContainerProps {
  children: React.ReactNode;
  delay?: number;
  staggerDelay?: number;
  reduceMotion?: boolean;
}

export function StaggerContainer({
  children,
  delay = 0,
  staggerDelay = 0.05,
  reduceMotion = false,
}: StaggerContainerProps) {
  const prefersReducedMotion = usePrefersReducedMotion(reduceMotion);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };
  const childrenArray = React.Children.toArray(children);

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      transition={{
        staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
        delayChildren: prefersReducedMotion ? 0 : delay,
      }}
      style={{ display: 'contents' }}
    >
      {childrenArray.map((child, childPosition) => {
        const itemKey =
          React.isValidElement(child) && child.key != null
            ? String(child.key)
            : `stagger-item-${childPosition}`;

        return (
          <m.div
            key={itemKey}
            variants={itemVariants}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {child}
          </m.div>
        );
      })}
    </m.div>
  );
}
