import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import React from 'react';

interface ButtonTriggerProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  text?: string;
}

export const ButtonTrigger: React.FC<ButtonTriggerProps> = ({
  onClick,
  className = '',
  disabled = false,
  loading = false,
  text,
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
      title={loading ? 'Triggering...' : 'Trigger'}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
      {text ?? (loading ? 'Triggering...' : 'Trigger')}
    </Button>
  );
};