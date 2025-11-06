import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonStartProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonStart: React.FC<ButtonStartProps> = ({
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
      variant="ghost"
      size="sm"
      className={`h-8 px-2 text-green-600 hover:bg-green-600/10 hover:text-green-500 ${className}`}
      onClick={handleClick}
      disabled={disabled || loading}
      title={loading ? 'Starting...' : 'Start'}
    >
      {loading ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-1 h-4 w-4" />
      )}
    </Button>
  );
};
