import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContainerStatusInfo } from '@/features/k8s/pods/utils/containerStatus';

interface WarningPodProps {
  warnings: ContainerStatusInfo[];
  className?: string;
  children: React.ReactElement;
}

export const WarningPod: React.FC<WarningPodProps> = ({ warnings, className = '', children }) => {
  const warningContainers = warnings.filter((warning) => !warning.ready && warning.reason);

  if (warningContainers.length === 0) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={`border border-gray-700 bg-gray-900 text-white ${className}`}>
        <div className="flex min-w-[200px] flex-col gap-1">
          <div className="text-sm font-semibold text-yellow-400">Warning</div>
          <div className="text-xs text-gray-300">
            {warningContainers.map((warning, index) => (
              <div key={index} className="flex items-center gap-1">
                <span>• </span>
                <span>{warning.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
