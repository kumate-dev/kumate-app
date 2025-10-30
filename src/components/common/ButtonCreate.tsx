import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonCreateProps {
  onCreate: () => void;
  className?: string;
}

export const ButtonCreate: React.FC<ButtonCreateProps> = ({ onCreate, className }) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onCreate}
      title="Create"
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
};
