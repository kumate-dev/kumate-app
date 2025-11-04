import { useState, useRef, useEffect } from 'react';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Dropdown({ trigger, children, className, disabled = false }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      className={`relative ${className} ${disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}`}
      ref={ref}
      aria-disabled={disabled}
    >
      <div onClick={() => !disabled && setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="absolute z-30 mt-1 min-w-full rounded border border-white/20 bg-neutral-900 p-1 shadow-lg">
          <div className="whitespace-nowrap">{children}</div>
        </div>
      )}
    </div>
  );
}
