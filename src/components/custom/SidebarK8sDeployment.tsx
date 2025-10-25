import { DeploymentItem } from '@/services/deployments';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { SidebarK8sResources } from './SidebarK8sResources';
import { k8sDeploymentStatusVariant } from '@/constants/variant';

interface SidebarDeploymentProps {
  item: DeploymentItem | null;
  setItem: (item: DeploymentItem | null) => void;
  onDelete?: (item: DeploymentItem) => void;
}

export function SidebarK8sDeployment({ item, setItem, onDelete }: SidebarDeploymentProps) {
  const sections = item
    ? [
        {
          key: 'basic',
          title: 'Basic Info',
          content: (i: DeploymentItem) => (
            <div className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-white/80">Name</h4>
                <p className="text-white">{i.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Namespace</h4>
                <p className="text-white">{i.namespace}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Ready</h4>
                <Badge variant={readyVariant(i.ready)}>{i.ready}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Age</h4>
                <AgeCell timestamp={i.creation_timestamp || ''} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Status</h4>
                <Badge variant={k8sDeploymentStatusVariant(i.status || '')}>{i.status || ''}</Badge>
              </div>
            </div>
          ),
        },
        {
          key: 'metadata',
          title: 'Metadata',
          content: (i: DeploymentItem) => (
            <div className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-white/80">Labels</h4>
                <pre className="text-xs text-white">labels</pre>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Annotations</h4>
                <pre className="text-xs text-white">annotations</pre>
              </div>
            </div>
          ),
        },
      ]
    : [];

  return (
    <SidebarK8sResources item={item} setItem={setItem} sections={sections} onDelete={onDelete} />
  );
}
