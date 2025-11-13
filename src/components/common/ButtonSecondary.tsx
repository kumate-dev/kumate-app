import React from 'react';

interface ButtonSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const ButtonSecondary: React.FC<ButtonSecondaryProps> = ({
  children,
  className = '',
  ...rest
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 focus:ring-2 focus:ring-white/20 focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default ButtonSecondary;
