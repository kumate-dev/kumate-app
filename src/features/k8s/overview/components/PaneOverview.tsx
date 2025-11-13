import { useEffect, useState } from 'react';
import { K8sContext } from '@/api/k8s/contexts';
import { getContextVersion } from '@/api/k8s/contexts';

interface PaneOverviewProps {
  context?: K8sContext | null;
}

export default function PaneOverview({ context }: PaneOverviewProps) {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    let active = true;
    const name = context?.name;
    if (!name) {
      setVersion('');
      return;
    }
    getContextVersion(name)
      .then((v) => {
        if (!active) return;
        setVersion(v || '');
      })
      .catch(() => {
        if (!active) return;
        setVersion('');
      });
    return () => {
      active = false;
    };
  }, [context?.name]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-semibold">
            {context?.display_name || context?.name || 'No selection'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {context?.name && (
              <div className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                Cluster: {context.name}
              </div>
            )}
            {version && (
              <div className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">
                Version: {version}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}
