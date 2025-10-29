import { K8sContext } from '@/api/k8s/contexts';
import PaneOverview from '@/features/k8s/overview/components/PaneOverview';

interface OverviewProps {
  context?: K8sContext | null;
}

export default function Overview({ context }: OverviewProps) {
  if (!context) {
    return <div className="p-4 text-white/70">No cluster selected.</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <PaneOverview context={context} />
    </div>
  );
}
