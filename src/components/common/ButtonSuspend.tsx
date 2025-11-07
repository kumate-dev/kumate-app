import { Button } from '@/components/ui/button';
import { Loader2, Pause, Play } from 'lucide-react';
import React from 'react';

interface ButtonSuspendProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  isSuspended?: boolean;
  textSuspend?: string;
  textResume?: string;
}

export const ButtonSuspend: React.FC<ButtonSuspendProps> = ({
  onClick,
  className = '',
  disabled = false,
  loading = false,
  isSuspended = false,
  textSuspend,
  textResume,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading) {
      onClick();
    }
  };

  const label = isSuspended ? (textResume ?? 'Resume') : (textSuspend ?? 'Suspend');
  const title = loading ? (isSuspended ? 'Resuming...' : 'Suspending...') : label;

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={title}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSuspended ? (
        <Play className="h-4 w-4" />
      ) : (
        <Pause className="h-4 w-4" />
      )}
      {loading ? (isSuspended ? 'Resuming...' : 'Suspending...') : label}
    </Button>
  );
};
