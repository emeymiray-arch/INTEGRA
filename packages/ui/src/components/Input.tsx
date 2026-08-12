import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-integra-gray-900">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border border-integra-gray-200 bg-white px-3 text-sm text-integra-gray-900 placeholder:text-integra-gray-400 transition-colors focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-integra-gray-50',
            error && 'border-integra-error focus:border-integra-error focus:ring-integra-error/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-integra-error">{error}</p>}
        {hint && !error && <p className="text-xs text-integra-gray-600">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
