import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonApplyProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
  loading?: boolean;
}

export const ButtonApply: React.FC<ButtonApplyProps> = ({
  onClick,
  disabled = false,
  text,
  className = '',
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
      title={loading ? 'Applying...' : 'Apply'}
      disabled={disabled || loading}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {text ?? (loading ? 'Applying...' : 'Apply')}
    </Button>
  );
};
