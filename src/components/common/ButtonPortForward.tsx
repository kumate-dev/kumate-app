import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Cable, Loader2 } from 'lucide-react';

export interface ButtonPortForwardProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ButtonPortForward({ onClick, disabled, loading }: ButtonPortForwardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50"
          onClick={onClick}
          disabled={disabled || loading}
          title="Port Forward"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>Port Forward</TooltipContent>
    </Tooltip>
  );
}
