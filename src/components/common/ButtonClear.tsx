import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonClearProps {
  onClick: () => void;
  className?: string;
  text?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonClear: React.FC<ButtonClearProps> = ({
  onClick,
  className = '',
  text,
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
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Clearing...' : 'Clear'}
      disabled={disabled || loading}
    >
      {text ?? (loading ? 'Clearing...' : 'Clear')}
    </Button>
  );
};
