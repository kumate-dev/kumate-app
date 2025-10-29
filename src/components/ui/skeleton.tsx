import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface SkeletonProps extends HTMLMotionProps<'div'> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <motion.div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-md bg-white/10 ${className}`}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      {...props}
    />
  );
};
