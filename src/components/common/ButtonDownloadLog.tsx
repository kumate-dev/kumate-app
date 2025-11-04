import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import React from 'react';

interface ButtonDownloadLogProps {
  onDownloadLogs: () => void;
  className?: string;
}

export const ButtonDownloadLog: React.FC<ButtonDownloadLogProps> = ({
  onDownloadLogs,
  className,
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`flex gap-1 px-3 ${className}`}
      onClick={onDownloadLogs}
      title="Download Logs"
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  );
};
