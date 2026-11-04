'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'glow';
  role?: string;
}

export function Chip({
  selected,
  onToggle,
  className,
  children,
  disabled,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={twMerge(
        'group relative px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-200',
        'flex items-center gap-2 border rounded-none [@media(pointer:coarse)]:min-h-11',
        selected
          ? 'bg-foreground text-background border-foreground'
          : 'bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">
        {selected && (
          <Check className="w-3 h-3" strokeWidth={3} />
        )}
        <span>
          {children}
        </span>
      </span>
    </button>
  );
}
