import { Button } from '@/components/ui/button';
import { Maximize2Icon, Minimize2Icon } from 'lucide-react';
import React from 'react';

interface ButtonExpandProps {
  onClick: () => void;
  isExpanded: boolean;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonExpand: React.FC<ButtonExpandProps> = ({
  onClick,
  isExpanded,
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

  const title = loading ? 'Loading...' : isExpanded ? 'Minimize' : 'Maximize';

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={title}
      disabled={disabled || loading}
    >
      {loading ? (
        <div className="h-4 w-4 animate-pulse bg-current opacity-50" />
      ) : isExpanded ? (
        <Minimize2Icon className="h-4 w-4" />
      ) : (
        <Maximize2Icon className="h-4 w-4" />
      )}
    </Button>
  );
};
