import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface IconEyeProps {
  masked: boolean;
  onClick: () => void;
  className?: string;
  title?: string;
}

export const IconEye: React.FC<IconEyeProps> = ({ masked, onClick, className = '', title }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const defaultTitle = masked ? 'Reveal' : 'Hide';
  const spanTitle = title || defaultTitle;

  return (
    <span
      role="button"
      tabIndex={0}
      className={`inline-flex h-3 w-3 shrink-0 cursor-pointer text-white/60 hover:text-white ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={spanTitle}
    >
      {masked ? (
        <Eye className="h-5 w-5" aria-label="Reveal" strokeWidth={2.25} />
      ) : (
        <EyeOff className="h-5 w-5" aria-label="Hide" strokeWidth={2.25} />
      )}
    </span>
  );
};
