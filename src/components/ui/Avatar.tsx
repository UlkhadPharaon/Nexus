import React from 'react';
import { cn, getInitials } from '../../utils/helpers';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallbackColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function Avatar({ src, alt = "Avatar", fallbackColor = "#6251EE", size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
    '2xl': "w-32 h-32 text-3xl",
  };

  const hasImage = Boolean(src);

  return (
    <div 
      className={cn(
        "relative rounded-sm flex items-center justify-center font-serif font-bold text-surface-950 shrink-0 overflow-hidden border border-white/5", 
        !hasImage && "shadow-inner",
        sizes[size], 
        className
      )}
      style={!hasImage ? { backgroundColor: fallbackColor } : {}}
    >
      {hasImage ? (
        <img 
          src={src!} 
          alt={alt} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{getInitials(alt)}</span>
      )}
    </div>
  );
}
