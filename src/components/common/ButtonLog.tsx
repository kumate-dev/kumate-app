import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonLogProps {
  onViewLogs: () => void;
  className?: string;
  text?: string;
}

export const ButtonLog: React.FC<ButtonLogProps> = ({
  onViewLogs,
  className,
  text,
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onViewLogs}
      title="Logs"
    >
      {text ?? 'Logs'}
    </Button>
  );
};
