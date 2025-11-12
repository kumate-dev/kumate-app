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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold">{context?.name || 'No selection'}</div>
          {version && (
            <div className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">{version}</div>
          )}
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}
