import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Adapted from Magic UI's MIT-licensed Blur Fade. See third-party-notices.txt.
// Used for the hero only; financial values and controls never animate on updates.
export function BlurFade({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 6, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: reduced ? 0 : 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
