import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonCreateProps {
  onCreate: () => void;
}

export const ButtonCreate: React.FC<ButtonCreateProps> = ({ onCreate }) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="ml-auto flex items-center gap-1 px-3"
      onClick={onCreate}
      title="Create"
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
};
