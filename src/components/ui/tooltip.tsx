import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const Tooltip: React.FC<React.ComponentProps<typeof TooltipPrimitive.Root>> = ({
  children,
  ...props
}) => (
  <TooltipPrimitive.Provider>
    <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);

interface TooltipTriggerProps extends React.ComponentProps<typeof TooltipPrimitive.Trigger> {
  className?: string;
}
export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ className = '', ...props }) => (
  <TooltipPrimitive.Trigger className={className} {...props} />
);

interface TooltipContentProps extends React.ComponentProps<typeof TooltipPrimitive.Content> {
  className?: string;
}
export const TooltipContent: React.FC<TooltipContentProps> = ({ className = '', ...props }) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={6}
      className={`animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 max-w-xs rounded-md border border-white/10 bg-neutral-900/90 px-2 py-1 text-xs text-white/80 shadow-lg backdrop-blur-sm ${className}`}
      {...props}
    />
  </TooltipPrimitive.Portal>
);
