import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  width?: string;
}

export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ label = '', width = 'w-full', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`h-9 rounded-md border border-white/20 bg-black/20 px-3 text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-white/30 ${width}`}
        {...props}
      >
        <div className="flex items-center justify-between">
          <span className="truncate text-sm">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
        </div>
      </button>
    );
  }
);

DropdownTrigger.displayName = 'DropdownTrigger';

export default DropdownTrigger;
