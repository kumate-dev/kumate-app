import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  children?: React.ReactNode;
}

export function Icon({ children, className = 'w-4 h-4', ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}
