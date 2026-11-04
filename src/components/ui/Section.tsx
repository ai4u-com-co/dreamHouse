'use client';

import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SectionProps {
  title: string;
  number?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  badge?: string;
  className?: string;
  accentColor?: 'primary' | 'secondary';
  summary?: React.ReactNode;
}

export function Section({
  title,
  number,
  icon,
  children,
  defaultOpen = false, // Changed default to false based on user requirement
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  badge,
  className,
  summary,
}: SectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen(!isOpen);
    }
  };

  return (
    <div
      className={twMerge(
        'group border-b border-border transition-all duration-300',
        isOpen ? 'pb-8' : '',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full py-8 flex items-start sm:items-center justify-between text-left hover:opacity-70 transition-opacity gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 w-full">
            {/* Number */}
            {number && (
                <span className={twMerge(
                  "text-5xl sm:text-6xl font-black transition-colors font-mono leading-none tracking-tighter",
                  isOpen ? "text-primary" : "text-muted-foreground/40 group-hover:text-primary"
                )}>
                    {number}
                </span>
            )}

            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                   {badge && (
                    <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 bg-foreground text-background">
                      {badge}
                    </span>
                  )}
                  <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
                    {icon && <span className="text-primary">{icon}</span>}
                    {title}
                  </h3>
                </div>
                {!isOpen && summary && (
                  <p className="text-xs text-muted-foreground font-mono tracking-wider uppercase mt-1 pl-1 opacity-70">
                    {summary}
                  </p>
                )}
            </div>
        </div>

        {/* Toggle button */}
        <div className="w-8 h-8 flex items-center justify-center border border-foreground rounded-full shrink-0 mt-2 sm:mt-0">
            {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </div>
      </button>
      
      {/* Collapsible content */}
      <div
        className={twMerge(
          'grid transition-all duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-4 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
