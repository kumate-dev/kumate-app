import React, { useEffect, useRef } from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  indeterminate?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, indeterminate, defaultChecked, onCheckedChange, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
    };

    return (
      <input
        type="checkbox"
        ref={internalRef}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={handleChange}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400"
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
