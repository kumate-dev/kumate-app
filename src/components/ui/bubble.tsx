import { Trash2 } from 'lucide-react';
import React from 'react';

interface SelectedBubbleProps {
  count: number;
  onDelete: () => void;
}

export const SelectedBubble: React.FC<SelectedBubbleProps> = ({ count, onDelete }) => {
  if (count === 0) return null;

  return (
    <div
      className="ml-auto flex h-8 cursor-pointer items-center rounded-full bg-red-600 px-3 text-sm font-medium text-white transition select-none hover:bg-red-700"
      onClick={onDelete}
      title="Delete selected"
    >
      <Trash2 className="h-4 w-4" />
    </div>
  );
};
