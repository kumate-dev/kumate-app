import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  className?: string;
  children?: React.ReactNode;
}

export function DialogContent({ className = '', children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-100 bg-black/20 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 fixed top-1/2 left-1/2 z-110 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-neutral-900/95 p-4 shadow-xl ${className}`}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="sm" className="absolute top-3 right-3 p-2">
            <X className="h-4 w-4" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

interface SimpleContainerProps {
  children?: React.ReactNode;
}

export function DialogHeader({ children }: SimpleContainerProps) {
  return <div className="mb-3 flex items-center justify-between">{children}</div>;
}

export function DialogTitle({ children }: SimpleContainerProps) {
  return <h2 className="text-base font-semibold text-white">{children}</h2>;
}

export function DialogFooter({ children }: SimpleContainerProps) {
  return <div className="mt-4 flex items-center justify-end gap-2">{children}</div>;
}
