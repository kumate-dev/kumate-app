import { Button } from '@/components/ui/button';
import React from 'react';

interface BubbleProps {
  count: number;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const Bubble: React.FC<BubbleProps> = ({ count, onClick, children }) => {
  if (count === 0) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      className="ml-auto flex items-center gap-1 px-3"
      onClick={onClick}
      title={typeof children === 'string' ? children : undefined}
    >
      {children || count}
    </Button>
  );
};
