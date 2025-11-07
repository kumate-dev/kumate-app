import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import { Button } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  className?: string;
  children?: React.ReactNode;
  hideTitle?: boolean;
  hideDescription?: boolean;
}

export function DialogContent({
  className = '',
  children,
  hideTitle = false,
  hideDescription = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={`data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 fixed top-1/2 left-1/2 z-[9999] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-neutral-900/95 p-4 shadow-xl ${className}`}
        {...props}
      >
        {hideTitle && (
          <DialogPrimitive.Title className="sr-only">Dialog title</DialogPrimitive.Title>
        )}

        {hideDescription && (
          <DialogPrimitive.Description className="sr-only">
            Dialog content
          </DialogPrimitive.Description>
        )}

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

interface DialogHeaderProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  hideTitle?: boolean;
  hideDescription?: boolean;
  actions?: React.ReactNode;
}

export function DialogHeader({
  title,
  description,
  hideTitle = false,
  hideDescription = false,
  actions,
}: DialogHeaderProps) {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        {hideTitle ? (
          <VisuallyHidden>
            <DialogTitle>{title}</DialogTitle>
          </VisuallyHidden>
        ) : (
          <DialogTitle>{title}</DialogTitle>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {description &&
        (hideDescription ? (
          <VisuallyHidden>
            <DialogDescription>{description}</DialogDescription>
          </VisuallyHidden>
        ) : (
          <DialogDescription>{description}</DialogDescription>
        ))}
    </div>
  );
}

export function DialogTitle({ children }: SimpleContainerProps) {
  return (
    <DialogPrimitive.Title asChild>
      <h2 className="text-base font-semibold text-white">{children}</h2>
    </DialogPrimitive.Title>
  );
}

export function DialogDescription({ children }: SimpleContainerProps) {
  return (
    <DialogPrimitive.Description asChild>
      <div className="text-sm text-white/80">{children}</div>
    </DialogPrimitive.Description>
  );
}

export function DialogFooter({ children }: SimpleContainerProps) {
  return <div className="mt-4 flex items-center justify-end gap-2">{children}</div>;
}

interface DialogCloseProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> {
  children?: React.ReactNode;
  className?: string;
}

export function DialogClose({ children, className = '', ...props }: DialogCloseProps) {
  return (
    <DialogPrimitive.Close asChild {...props}>
      <Button variant="ghost" size="sm" className={`p-2 ${className}`}>
        {children ?? <X className="h-4 w-4" />}
      </Button>
    </DialogPrimitive.Close>
  );
}
