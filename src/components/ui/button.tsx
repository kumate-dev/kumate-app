import React from 'react';

type ButtonVariant = 'default' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-white/10 hover:bg-white/20 text-white',
  outline: 'border border-white/20 bg-transparent hover:bg-white/10 text-white',
  ghost: 'bg-transparent hover:bg-white/10 text-white',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  );
};

export default Button;
