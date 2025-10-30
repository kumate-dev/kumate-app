import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonCancelProps {
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
}

export const ButtonCancel: React.FC<ButtonCancelProps> = ({ onCancel, disabled, className }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onCancel}
      title="Cancel"
      disabled={disabled}
    >
      Cancel
    </Button>
  );
};
