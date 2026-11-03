'use client';

import React, { useState, useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';

interface DebouncedInputProps {
  id?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  type?: 'text' | 'number' | 'textarea';
  debounceTime?: number;
  min?: number;
  max?: number;
}

export function DebouncedInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  type = 'text',
  debounceTime = 300,
  min,
  max,
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external value to local state
  useEffect(() => {
    setLocalValue(String(value ?? ''));
  }, [value]);

  // Handle cleanup of timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalValue(val);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(val);
    }, debounceTime);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Instantly propagate the value on blur
    onChange(localValue);
  };

  const commonClasses = 'w-full bg-card border border-border py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  if (type === 'textarea') {
    return (
      <textarea
        id={id}
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={twMerge(commonClasses, 'h-32 resize-y', className)}
      />
    );
  }

  return (
    <input
      id={id}
      type={type}
      value={localValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      className={twMerge(commonClasses, className)}
    />
  );
}
