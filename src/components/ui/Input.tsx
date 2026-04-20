import React, { useState } from 'react';
import { cn } from '../../utils/helpers';
import { Sparkles, Loader2 } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  onSurpriseMe?: () => Promise<void>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, onSurpriseMe, ...props }, ref) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSurpriseMe = async () => {
      if (!onSurpriseMe) return;
      setIsGenerating(true);
      try {
        await onSurpriseMe();
      } finally {
        setIsGenerating(false);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-text-secondary">{label}</label>
            {onSurpriseMe && (
              <button
                type="button"
                onClick={handleSurpriseMe}
                disabled={isGenerating}
                className="flex items-center gap-1 text-[10px] font-medium text-primary-400 hover:text-primary-300 transition-colors uppercase tracking-wider disabled:opacity-50"
                title="Surprends-moi !"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Surprends-moi
              </button>
            )}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "input-field",
            error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
