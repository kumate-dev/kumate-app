import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonSaveProps {
  onSave: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
}

export const ButtonSave: React.FC<ButtonSaveProps> = ({ onSave, disabled, text, className }) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onSave}
      title="Save"
      disabled={disabled}
    >
      {text ?? 'Save'}
    </Button>
  );
};
