import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import React from 'react';

interface ButtonRestartProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
  loading?: boolean;
  showIcon?: boolean;
}

export const ButtonRestart: React.FC<ButtonRestartProps> = ({
  onClick,
  disabled = false,
  text,
  className = '',
  loading = false,
  showIcon = true,
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
      title={loading ? 'Restarting...' : 'Restart'}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        showIcon && <RotateCcw className="h-4 w-4" />
      )}
      {text ?? (loading ? 'Restarting...' : 'Restart')}
    </Button>
  );
};
