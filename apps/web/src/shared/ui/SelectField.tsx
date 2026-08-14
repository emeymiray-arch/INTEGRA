import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, id, className, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-integra-gray-900">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-10 w-full rounded-lg border border-integra-gray-200 bg-white px-3 text-sm text-integra-gray-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:bg-integra-gray-50 ${
            error ? 'border-integra-error' : ''
          } ${className ?? ''}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-integra-error">{error}</p>}
      </div>
    );
  },
);

SelectField.displayName = 'SelectField';
