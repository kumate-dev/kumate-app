import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { BadgeVariant } from '@/types/variant';
import { DeploymentItem } from '@/services/deployments';
import Button from '../ui/button';

interface SidebarProps {
  item: DeploymentItem | null;
  setItem: (item: DeploymentItem | null) => void;
  width?: string;
}

export function SidebarK8sDeployment({ item, setItem, width = '500px' }: SidebarProps) {
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});

  if (!item) return null;

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const statusVariant = (s: string): BadgeVariant => {
    switch (s) {
      case 'Available':
        return 'success';
      case 'Progressing':
      case 'Scaling':
        return 'warning';
      case 'Terminating':
        return 'secondary';
      case 'Failed':
      case 'Unavailable':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full translate-x-0 transform border-l border-white/10 bg-neutral-900/95 shadow-xl transition-transform duration-300 ease-in-out w-[${width}] z-50 flex flex-col`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-white">Deployment Detail</h2>
        <Button variant="ghost" size="sm" onClick={() => setItem(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {/* Basic Info */}
        <div>
          <h3
            className="mb-2 flex cursor-pointer items-center justify-between text-white/80 select-none"
            onClick={() => toggleSection('basic')}
          >
            <span>Basic Info</span>
            {sectionsOpen['basic'] ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </h3>
          {sectionsOpen['basic'] !== false && (
            <div className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-white/80">Name</h4>
                <p className="text-white">{item.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Namespace</h4>
                <p className="text-white">{item.namespace}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Ready</h4>
                <Badge variant={readyVariant(item.ready)}>{item.ready}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Age</h4>
                <AgeCell timestamp={item.creation_timestamp || ''} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white/80">Status</h4>
                <Badge variant={statusVariant(item.status || '')}>{item.status || ''}</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Section */}
        <div>
          <h3
            className="mb-2 flex cursor-pointer items-center justify-between text-white/80 select-none"
            onClick={() => toggleSection('metadata')}
          >
            <span>Metadata</span>
            {sectionsOpen['metadata'] ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </h3>
          {sectionsOpen['metadata'] && (
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
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-end gap-2 border-t border-white/10 p-4">
        <Button variant="outline" onClick={() => setItem(null)}>
          Close
        </Button>
        <Button variant="destructive">Delete</Button>
      </div>
    </div>
  );
}
