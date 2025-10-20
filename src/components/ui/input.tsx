import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-9 w-full rounded-md border border-white/20 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-white/30 ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
