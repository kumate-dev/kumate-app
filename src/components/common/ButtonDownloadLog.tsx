import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import React from 'react';

interface ButtonDownloadLogProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const ButtonDownloadLog: React.FC<ButtonDownloadLogProps> = ({
  onClick,
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

  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={handleClick}
      title={loading ? 'Downloading...' : 'Download Logs'}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading && 'Downloading...'}
    </Button>
  );
};
