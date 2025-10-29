import { useEffect, useRef, useState } from 'react';
import { SidebarMenu } from '@/features/k8s/common/components/SidebarMenu';
import { useNamespaceStore } from '@/store/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import Overview from '@/features/k8s/overview/components/Overview';
import PaneNodes from '@/features/k8s/nodes/components/PaneNodes';
import PaneNamespaces from '@/features/k8s/namespaces/components/PaneNamespaces';
import PaneSecrets from '@/features/k8s/secrets/components/PaneSecrets';
import PaneResourceQuotas from '@/features/k8s/resourceQuotas/components/PaneResourceQuotas';
import PaneLimitRanges from '@/features/k8s/limitRanges/components/PaneLimitRanges';
import PaneHorizontalPodAutoscalers from '@/features/k8s/horizontalPodAutoscalers/components/PaneHorizontalPodAutoscalers';
import PanePodDisruptionBudgets from '@/features/k8s/podDisruptionBudgets/components/PanePodDisruptionBudgets';
import PaneReplicaSets from '@/features/k8s/replicaSets/components/PaneReplicaSets';
import PaneStatefulSets from '@/features/k8s/statefulSets/components/PaneStatefulSets';
import PaneJobs from '@/features/k8s/jobs/components/PaneJobs';
import ComingSoon from './ComingSoon';
import Pods from '@/features/k8s/pods/pages/Pods';
import ConfigMaps from '@/features/k8s/configMaps/pages/ConfigMaps';
import CronJobs from '@/features/k8s/cronJobs/pages/CronJobs';
import DaemonSets from '@/features/k8s/daemonSets/pages/DaemonSets';
import Deployments from '@/features/k8s/deployments/pages/Deployments';
import HorizontalPodAutoscalers from '@/features/k8s/horizontalPodAutoscalers/pages/HorizontalPodAutoscalers';

export default function Home() {
  const [contexts, setContexts] = useState<K8sContext[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<K8sContext | null>(null);
  const [page, setPage] = useState<PageKey>('overview');

  const resetNsToAll = () => useNamespaceStore.setState({ selectedNamespaces: [ALL_NAMESPACES] });
  const selectedRef = useRef(selected);

  useEffect(() => {
    async function fetchContexts() {
      setError('');
      setLoading(true);
      try {
        let list: K8sContext[] = [];
        try {
          list = (await listContexts()) || [];
        } catch {
          setContexts([]);
          setSelected(null);
          return;
        }

        if (list.length === 0) {
          try {
            await importKubeContexts();
          } catch {}
          try {
            list = (await listContexts()) || [];
          } catch {}
        }
        setContexts(list);

        if (!selectedRef.current && list.length > 0) setSelected(list[0]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    fetchContexts();
  }, []);

  useEffect(() => {
    if (selected?.name) resetNsToAll();
  }, [selected?.name]);

  const pageComponents: Record<string, React.FC<{ context?: K8sContext | null }>> = {
    overview: Overview,
    nodes: PaneNodes,
    namespaces: PaneNamespaces,
    pods: Pods,
    deployments: Deployments,
    config_maps: ConfigMaps,
    secrets: PaneSecrets,
    resource_quotas: PaneResourceQuotas,
    limit_ranges: PaneLimitRanges,
    horizontal_pod_autoscalers: HorizontalPodAutoscalers,
    pod_disruption_budgets: PanePodDisruptionBudgets,
    replica_sets: PaneReplicaSets,
    stateful_sets: PaneStatefulSets,
    daemon_sets: DaemonSets,
    jobs: PaneJobs,
    cron_jobs: CronJobs,
  };

  const PageComponent = pageComponents[page] || ComingSoon;

  return (
    <div className="flex h-screen bg-neutral-950 text-white">
      <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-white/10">
        <SidebarMenu
          contexts={contexts}
          selected={selected ?? undefined}
          onSelectContext={(c) => {
            setSelected(c ?? null);
            setPage('overview');
          }}
          page={page}
          onSelectPage={(p) => setPage(p as PageKey)}
        />
      </aside>

      <main className="relative flex-1 overflow-hidden">
        {error && (
          <div className="m-4 rounded border border-red-400/30 bg-red-500/10 p-2 text-red-400">
            {error}
          </div>
        )}

        <div className="h-full overflow-y-auto p-4">
          <PageComponent context={selected ?? undefined} />
        </div>
      </main>
    </div>
  );
}
