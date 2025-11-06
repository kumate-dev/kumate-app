import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonCreateProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonCreate: React.FC<ButtonCreateProps> = ({
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
      title={loading ? 'Creating...' : 'Create'}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {loading && 'Creating...'}
    </Button>
  );
};
