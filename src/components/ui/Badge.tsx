import React from 'react';
import { cn } from '../../utils/helpers';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'accent' | 'outline' | 'success' | 'danger';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-surface-700 text-text-secondary w-fit",
    primary: "bg-primary-500/10 text-primary-400 border border-primary-500/20 w-fit",
    accent: "bg-accent-500/10 text-accent-400 border border-accent-500/20 w-fit",
    outline: "border border-white/10 text-text-muted w-fit",
    success: "bg-green-500/10 text-green-400 border border-green-500/20 w-fit",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 w-fit",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
