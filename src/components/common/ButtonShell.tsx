import { Terminal } from 'lucide-react';
import React from 'react';
import Button from '../ui/button';

interface ButtonShellProps {
  onOpenShell: () => void;
  className?: string;
  text?: string;
}

export const ButtonShell: React.FC<ButtonShellProps> = ({ onOpenShell, className, text }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onOpenShell}
      title="Shell"
    >
      <Terminal className="h-3.5 w-3.5" />
      {text ?? 'Shell'}
    </Button>
  );
};
