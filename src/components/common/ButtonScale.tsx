import { Button } from '@/components/ui/button';
import { Loader2, Expand } from 'lucide-react';
import React from 'react';

interface ButtonScaleProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
  loading?: boolean;
  showIcon?: boolean;
}

export const ButtonScale: React.FC<ButtonScaleProps> = ({
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
      title={loading ? 'Scaling...' : 'Scale'}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        showIcon && <Expand className="h-4 w-4" />
      )}
      {text ?? (loading ? 'Scaling...' : 'Scale')}
    </Button>
  );
};
