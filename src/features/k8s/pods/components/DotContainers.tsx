import { getContainerDotColor } from '../utils/containerDotColor';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContainerStatusInfo } from '../utils/containerStatus';

interface DotContainersProps {
  containerStatuses?: ContainerStatusInfo[];
}

export function DotContainers({ containerStatuses }: DotContainersProps) {
  const containersCount = containerStatuses?.length || 0;

  if (containerStatuses && containersCount > 0) {
    return (
      <div className="inline-flex items-center gap-1">
        {containerStatuses.map((status, idx) => {
          const message = status.message || '';
          const isReady = status.ready;
          const statusText = isReady ? 'Ready' : 'Warning';
          const statusColor = isReady ? 'text-green-400' : 'text-yellow-400';

          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <span className={`h-2.5 w-2.5 rounded-full ${getContainerDotColor(status)}`} />
              </TooltipTrigger>
              <TooltipContent className="border border-gray-700 bg-gray-900 text-white">
                <div className="flex max-w-xs flex-col gap-1 text-xs">
                  <div className={`font-medium ${statusColor}`}>{statusText}</div>

                  <div className="text-gray-300">
                    <span>• Name: </span>
                    <span>{status.name}</span>
                  </div>

                  {!isReady && message && (
                    <div className="text-gray-300">
                      <span>• </span>
                      <span>{message}</span>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return <span className="text-white/50">-</span>;
}
