import { useEffect, useRef, useState } from 'react';
import { SidebarMenu } from '@/components/k8s/menu/SidebarMenu';
import { useNamespaceStore } from '@/store/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import Overview from '@/components/k8s/overview/Overview';
import PaneNodes from '@/components/k8s/nodes/PaneNodes';
import PaneNamespaces from '@/components/k8s/namespaces/PaneNamespaces';
import PanePods from '@/components/k8s/pods/PanePods';
import PaneDeployments from '@/components/k8s/deployments/PaneDeployments';
import PaneConfigMaps from '@/components/k8s/configMaps/PaneConfigMaps';
import PaneSecrets from '@/components/k8s/secrets/PaneSecrets';
import PaneResourceQuotas from '@/components/k8s/resourceQuotas/PaneResourceQuotas';
import PaneLimitRanges from '@/components/k8s/limitRanges/PaneLimitRanges';
import PaneHorizontalPodAutoscalers from '@/components/k8s/horizontalPodAutoscalers/PaneHorizontalPodAutoscalers';
import PanePodDisruptionBudgets from '@/components/k8s/podDisruptionBudgets/PanePodDisruptionBudgets';
import PaneReplicaSets from '@/components/k8s/replicaSets/PaneReplicaSets';
import PaneStatefulSets from '@/components/k8s/statefulSets/PaneStatefulSets';
import PaneDaemonSets from '@/components/k8s/daemonSets/PaneDaemonSets';
import PaneJobs from '@/components/k8s/jobs/PaneJobs';
import PaneCronJobs from '@/components/k8s/cronJobs/PaneCronJobs';
import ComingSoon from './ComingSoon';

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

  const pageComponents: Record<string, React.FC<{ context?: K8sContext }>> = {
    overview: Overview,
    nodes: PaneNodes,
    namespaces: PaneNamespaces,
    pods: PanePods,
    deployments: PaneDeployments,
    config_maps: PaneConfigMaps,
    secrets: PaneSecrets,
    resource_quotas: PaneResourceQuotas,
    limit_ranges: PaneLimitRanges,
    horizontal_pod_autoscalers: PaneHorizontalPodAutoscalers,
    pod_disruption_budgets: PanePodDisruptionBudgets,
    replica_sets: PaneReplicaSets,
    stateful_sets: PaneStatefulSets,
    daemon_sets: PaneDaemonSets,
    jobs: PaneJobs,
    cron_jobs: PaneCronJobs,
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
