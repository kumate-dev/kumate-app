
import { Button } from '@/components/ui/button';
import { Maximize2Icon, Minimize2Icon } from 'lucide-react';
import React from 'react';

interface ButtonExpandProps {
  onExpand: () => void;
  isExpanded: boolean;
  className?: string;
}

export const ButtonExpand: React.FC<ButtonExpandProps> = ({ onExpand, isExpanded, className }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onExpand}
    >
      {isExpanded ? <Minimize2Icon className="h-4 w-4" /> : <Maximize2Icon className="h-4 w-4" />}
    </Button>
  );
};
