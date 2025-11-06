import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonTrashProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonTrash: React.FC<ButtonTrashProps> = ({
  onClick,
  className = '',
  disabled = false,
  loading = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading) {
      onClick();
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Deleting...' : 'Delete selected'}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {loading && 'Deleting...'}
    </Button>
  );
};
