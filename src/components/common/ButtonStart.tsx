import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import React from 'react';

interface ButtonStartProps {
  onStart: () => void;
  className?: string;
  disabled?: boolean;
}

export const ButtonStart: React.FC<ButtonStartProps> = ({ onStart, className, disabled }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 px-2 text-green-600 hover:bg-green-600/10 hover:text-green-500 ${className}`}
      onClick={onStart}
      disabled={disabled}
    >
      <Play className="mr-1 h-4 w-4" />
    </Button>
  );
};
