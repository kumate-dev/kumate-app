import { AlertTriangle } from 'lucide-react';
import { ComponentProps } from 'react';

interface IconWarningProps extends ComponentProps<typeof AlertTriangle> {
  className?: string;
}

export function IconWarning({ className = '', ...props }: IconWarningProps) {
  return (
    <AlertTriangle className={`inline-block h-4 w-4 text-yellow-400 ${className}`} {...props} />
  );
}
