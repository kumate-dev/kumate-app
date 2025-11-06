import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonDeleteProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  text?: string;
  loading?: boolean;
}

export const ButtonDelete: React.FC<ButtonDeleteProps> = ({
  onClick,
  disabled = false,
  className = '',
  text,
  loading = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !loading) {
      onClick();
    }
  };

  const displayText = text ?? 'Delete';
  const isDisabled = disabled || loading;

  return (
    <Button
      variant="destructive"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Deleting...' : 'Delete'}
      disabled={isDisabled}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Deleting...
        </>
      ) : (
        displayText
      )}
    </Button>
  );
};
