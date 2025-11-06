import { Button } from '@/components/ui/button';
import { Square, Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonStopProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonStop: React.FC<ButtonStopProps> = ({
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
      className={`h-8 px-2 text-red-600 hover:bg-red-600/10 hover:text-red-500 ${className}`}
      onClick={handleClick}
      disabled={disabled || loading}
      title={loading ? 'Stopping...' : 'Stop'}
    >
      {loading ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Square className="mr-1 h-4 w-4" />
      )}
    </Button>
  );
};
