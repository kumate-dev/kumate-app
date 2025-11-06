import { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Dropdown({ trigger, children, className = '', disabled = false }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  }, [disabled]);

  const dropdownClass = `relative ${className} ${disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}`;

  return (
    <div className={dropdownClass} ref={ref} aria-disabled={disabled}>
      <div onClick={handleTriggerClick}>{trigger}</div>
      {open && (
        <div className="absolute z-30 mt-1 min-w-full rounded border border-white/20 bg-neutral-900 p-1 shadow-lg">
          <div className="whitespace-nowrap">{children}</div>
        </div>
      )}
    </div>
  );
}
