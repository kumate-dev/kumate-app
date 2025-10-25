import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  width?: string;
}

export function Sidebar({ open, onClose, children, width = '500px' }: SidebarProps) {
  return (
    <div
      className={`fixed top-0 right-0 h-full transform border-l border-white/10 bg-neutral-900/95 shadow-xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'} w-[${width}] z-50 overflow-auto`}
    >
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div></div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
