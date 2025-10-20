import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'secondary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-white/10 text-white',
    success: 'bg-emerald-500/20 text-emerald-200',
    secondary: 'bg-neutral-500/20 text-neutral-200',
    warning: 'bg-amber-500/20 text-amber-200',
    error: 'bg-red-500/20 text-red-200',
  };

  return (
    <span
      className={`inline-flex h-6 items-center rounded px-2 text-xs ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
