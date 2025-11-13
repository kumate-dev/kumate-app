import { Button } from '@/components/ui/button';
import React from 'react';

interface ButtonLogProps {
  onClick: () => void;
  className?: string;
  text?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonLog: React.FC<ButtonLogProps> = ({
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
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Loading logs...' : 'View Logs'}
      disabled={disabled || loading}
    >
      {text ?? (loading ? 'Loading...' : 'Logs')}
    </Button>
  );
};
