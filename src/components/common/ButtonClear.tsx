import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonClearProps {
  onClearLogs: () => void;
  className?: string;
  text?: string;
}

export const ButtonClear: React.FC<ButtonClearProps> = ({ onClearLogs, className, text }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onClearLogs}
      title="Clear Logs"
    >
      {text ?? 'Clear'}
    </Button>
  );
};
