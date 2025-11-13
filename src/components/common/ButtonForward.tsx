import React from 'react';
import { Button } from '@/components/ui/button';

interface ButtonForwardProps {
  onClick: () => void;
  className?: string;
  text?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonForward: React.FC<ButtonForwardProps> = ({
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
      title={loading ? 'Forwarding...' : 'Forward'}
      disabled={disabled || loading}
    >
      {text ?? (loading ? 'Forwarding...' : 'Forward')}
    </Button>
  );
};

export default ButtonForward;