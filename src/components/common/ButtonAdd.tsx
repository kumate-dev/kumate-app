import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonAddProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}

export const ButtonAdd: React.FC<ButtonAddProps> = ({
  onClick,
  className = '',
  disabled = false,
  loading = false,
  title = 'Add key',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading) {
      onClick();
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Adding...' : title}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {loading && 'Adding...'}
    </Button>
  );
};
