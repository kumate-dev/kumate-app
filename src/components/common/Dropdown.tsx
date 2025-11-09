import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
}

export function Dropdown({
  trigger,
  children,
  className = '',
  disabled = false,
  closeOnSelect = true,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    const clickedInTrigger = ref.current && ref.current.contains(target);
    const clickedInMenu = menuRef.current && menuRef.current.contains(target);
    if (!clickedInTrigger && !clickedInMenu) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  }, [disabled]);

  const dropdownClass = `relative ${className} ${disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : ''}`;

  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updatePosition]);

  return (
    <div className={dropdownClass} ref={ref} aria-disabled={disabled}>
      <div onClick={handleTriggerClick}>{trigger}</div>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="pointer-events-auto fixed z-[1000] rounded border border-white/20 bg-neutral-900 p-1 shadow-lg"
            style={{ top: position.top + 4, left: position.left, minWidth: position.width }}
            onClick={() => {
              if (closeOnSelect) {
                // Delay closing slightly to allow child onClick handlers to run and flush state updates
                setTimeout(() => setOpen(false), 0);
              }
            }}
          >
            <div className="whitespace-nowrap">{children}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
