import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface BubbleTrashProps {
  onDelete: () => void;
}

export const BubbleTrash: React.FC<BubbleTrashProps> = ({ onDelete }) => {
  return (
    <Button
      variant="destructive"
      size="sm"
      className="ml-auto flex items-center gap-1 px-3"
      onClick={onDelete}
      title="Delete selected"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
};
