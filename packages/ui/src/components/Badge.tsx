import { type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'accent'
  | 'muted';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-integra-gray-100 text-integra-gray-900',
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/15 text-primary-light',
  success: 'bg-integra-success/15 text-integra-success',
  warning: 'bg-accent/15 text-accent-dark',
  error: 'bg-integra-error/15 text-integra-error',
  info: 'bg-secondary/15 text-secondary',
  accent: 'bg-accent/15 text-accent-dark',
  muted: 'bg-integra-gray-100 text-integra-gray-600',
};

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
