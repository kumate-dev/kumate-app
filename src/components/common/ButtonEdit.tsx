import { Button } from '@/components/ui/button';
import { SquarePen } from 'lucide-react';
import React from 'react';

interface ButtonEditProps {
  onEdit: () => void;
  className?: string;
}

export const ButtonEdit: React.FC<ButtonEditProps> = ({ onEdit, className }) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onEdit}
      title="Edit"
    >
      <SquarePen className="h-4 w-4" />
    </Button>
  );
};
