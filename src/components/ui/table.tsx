import React, { forwardRef } from 'react';

export function Table({ className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`w-full border-collapse text-left text-sm ${className}`} {...props} />;
}

export function Thead({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`text-white/70 ${className}`} {...props} />;
}

export function Tbody({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function Tr({ className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-white/10 ${className}`} {...props} />;
}

export function Th({ className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`sticky top-0 bg-neutral-900/70 px-3 py-2 font-medium ${className}`}
      {...props}
    />
  );
}

export const Td = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    return <td ref={ref} className={`px-3 py-2 ${className}`} {...props} />;
  }
);

Td.displayName = 'Td';
