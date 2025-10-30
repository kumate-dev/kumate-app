import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonDeleteProps {
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}

export const ButtonDelete: React.FC<ButtonDeleteProps> = ({ onDelete, disabled, className }) => {
  return (
    <Button
      variant="destructive"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onDelete}
      title="Delete"
      disabled={disabled}
    >
      Delete
    </Button>
  );
};
