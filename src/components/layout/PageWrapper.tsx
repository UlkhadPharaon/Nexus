import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';

export function PageWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn("w-full h-full min-h-screen", className)}
    >
      {children}
    </motion.div>
  );
}
