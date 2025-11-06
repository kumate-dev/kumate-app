import { Terminal, Loader2 } from 'lucide-react';
import React from 'react';
import Button from '../ui/button';

interface ButtonShellProps {
  onClick: () => void;
  className?: string;
  text?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonShell: React.FC<ButtonShellProps> = ({
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
      title={loading ? 'Opening shell...' : 'Open Shell'}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Terminal className="h-3.5 w-3.5" />
      )}
      {text ?? (loading ? 'Opening...' : 'Shell')}
    </Button>
  );
};
