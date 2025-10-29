import { useEffect, useRef, useState } from 'react';
import { SidebarMenu } from '@/components/k8s/menu/SidebarMenu';
import { useNamespaceStore } from '@/store/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import Overview from '@/components/k8s/overview/Overview';
import PaneK8sNodes from '@/components/k8s/nodes/PaneK8sNodes';
import PaneK8sNamespaces from '@/components/k8s/namespaces/PaneK8sNamespaces';
import PaneK8sPods from '@/components/k8s/pods/PaneK8sPods';
import PaneK8sDeployments from '@/components/k8s/deployments/PaneK8sDeployments';
import PaneK8sConfigMaps from '@/components/k8s/configMaps/PaneK8sConfigMaps';
import PaneK8sSecrets from '@/components/k8s/secrets/PaneK8sSecrets';
import PaneK8sResourceQuotas from '@/components/k8s/resourceQuotas/PaneK8sResourceQuotas';
import PaneK8sLimitRanges from '@/components/k8s/limitRanges/PaneK8sLimitRanges';
import PaneK8sHorizontalPodAutoscalers from '@/components/k8s/horizontalPodAutoscalers/PaneK8sHorizontalPodAutoscalers';
import PaneK8sPodDisruptionBudgets from '@/components/k8s/podDisruptionBudgets/PaneK8sPodDisruptionBudgets';
import PaneK8sReplicaSets from '@/components/k8s/replicaSets/PaneK8sReplicaSets';
import PaneK8sStatefulSets from '@/components/k8s/statefulSets/PaneK8sStatefulSets';
import PaneK8sDaemonSets from '@/components/k8s/daemonSets/PaneK8sDaemonSets';
import PaneK8sJobs from '@/components/k8s/jobs/PaneK8sJobs';
import PaneK8sCronJobs from '@/components/k8s/cronJobs/PaneK8sCronJobs';
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
    nodes: PaneK8sNodes,
    namespaces: PaneK8sNamespaces,
    pods: PaneK8sPods,
    deployments: PaneK8sDeployments,
    config_maps: PaneK8sConfigMaps,
    secrets: PaneK8sSecrets,
    resource_quotas: PaneK8sResourceQuotas,
    limit_ranges: PaneK8sLimitRanges,
    horizontal_pod_autoscalers: PaneK8sHorizontalPodAutoscalers,
    pod_disruption_budgets: PaneK8sPodDisruptionBudgets,
    replica_sets: PaneK8sReplicaSets,
    stateful_sets: PaneK8sStatefulSets,
    daemon_sets: PaneK8sDaemonSets,
    jobs: PaneK8sJobs,
    cron_jobs: PaneK8sCronJobs,
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
