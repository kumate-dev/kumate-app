import { V1ContainerStatus } from '@kubernetes/client-node';
import { getContainerDotColor } from '../utils/containerDotColor';

interface DotContainersProps {
  containerStatuses?: V1ContainerStatus[];
  containersCount?: number;
}

export function DotContainers({ containerStatuses, containersCount = 0 }: DotContainersProps) {
  if (containerStatuses && containerStatuses.length > 0) {
    return (
      <div className="inline-flex items-center gap-1">
        {containerStatuses.map((status, idx) => (
          <span
            key={idx}
            className={`h-2.5 w-2.5 rounded-full ${getContainerDotColor(status)}`}
            title={`${status.name}: ${status.state?.running ? 'Running' : status.state?.waiting?.reason || status.state?.terminated?.reason || 'Unknown'}`}
          />
        ))}
      </div>
    );
  }

  if (containersCount > 0) {
    return (
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: containersCount }).map((_, idx) => (
          <span
            key={idx}
            className="h-2.5 w-2.5 rounded-full bg-white/30"
            title="Container status unknown"
          />
        ))}
      </div>
    );
  }

  return <span className="text-white/50">-</span>;
}
