import { Button } from '@/components/ui/button';
import { SquarePen, Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonEditProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonEdit: React.FC<ButtonEditProps> = ({
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
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Editing...' : 'Edit'}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}
      {loading && 'Editing...'}
    </Button>
  );
};
