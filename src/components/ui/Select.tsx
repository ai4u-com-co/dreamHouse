import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: (string | number)[];
  containerClassName?: string;
}

export function Select({
  label,
  options,
  className,
  containerClassName,
  id,
  ...props
}: SelectProps) {
  // La etiqueta debe estar enlazada al control: sin esto un lector de pantalla (y getByLabel) no los asocia
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={twMerge('flex flex-col gap-2 group', containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={twMerge(
            'w-full appearance-none bg-card border border-border py-3 px-4 pr-10 rounded-none',
            'text-foreground text-sm font-medium uppercase tracking-wide',
            'focus:outline-none focus:border-primary focus:ring-0',
            'transition-colors duration-200',
            'hover:border-foreground cursor-pointer',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-card text-foreground py-2">
              {opt}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
