import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonCancelProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
}

export const ButtonCancel: React.FC<ButtonCancelProps> = ({
  onClick,
  disabled = false,
  className = '',
  text,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title="Cancel"
      disabled={disabled}
    >
      {text ?? 'Cancel'}
    </Button>
  );
};
