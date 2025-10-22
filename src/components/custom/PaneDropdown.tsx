import { useState, useRef, useEffect } from 'react';

interface PaneDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PaneDropdown({ trigger, children, className }: PaneDropdownProps) {
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
    <div className={`relative ${className}`} ref={ref}>
      <div onClick={() => setOpen(!open)}>
        {trigger}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 min-w-full rounded border border-white/20 bg-neutral-900 p-1 shadow-lg">
          <div className="whitespace-nowrap">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
