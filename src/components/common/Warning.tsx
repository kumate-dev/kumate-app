import { AlertTriangle } from 'lucide-react';
import { ComponentProps } from 'react';

interface WarningProps extends ComponentProps<typeof AlertTriangle> {
  className?: string;
}

export function Warning({ className = '', ...props }: WarningProps) {
  return (
    <AlertTriangle className={`inline-block h-4 w-4 text-yellow-400 ${className}`} {...props} />
  );
}
