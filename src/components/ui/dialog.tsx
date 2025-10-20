import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  className?: string;
  children?: React.ReactNode;
}

export function DialogContent({
  className = "",
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={`fixed left-1/2 top-1/2 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-neutral-900/95 p-4 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 ${className}`}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-3 top-3 p-2"
          >
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
