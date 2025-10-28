import React, { forwardRef } from 'react';

export function Table({ className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={`w-full table-auto border-collapse text-left text-sm ${className}`}
      {...props}
    />
  );
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

export function Th({
  className = '',
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`sticky top-0 bg-neutral-900/70 px-3 py-2 text-sm font-medium whitespace-nowrap ${className}`}
      {...props}
    >
      <div className="flex items-center justify-between gap-1">
        {children}
        <span className="inline-block h-4 w-4 shrink-0" />
      </div>
    </th>
  );
}

export const Td = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`overflow-hidden px-3 py-2 align-middle text-sm text-ellipsis whitespace-nowrap ${className}`}
        {...props}
      />
    );
  }
);

Td.displayName = 'Td';
