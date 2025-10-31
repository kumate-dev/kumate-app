import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';
import React from 'react';

interface ButtonStopProps {
  onStop: () => void;
  className?: string;
}

export const ButtonStop: React.FC<ButtonStopProps> = ({ onStop, className }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 px-2 text-red-600 hover:bg-red-600/10 hover:text-red-500 ${className}`}
      onClick={onStop}
    >
      <Square className="mr-1 h-4 w-4" />
    </Button>
  );
};
