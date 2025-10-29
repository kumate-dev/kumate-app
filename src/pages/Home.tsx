import { useEffect, useRef, useState } from 'react';
import PaneOverview from '@/components/k8s/overview/PaneOverview';
import PaneK8sPod from '@/components/k8s/pods/PaneK8sPods';
import PaneK8sNode from '@/components/k8s/nodes/PaneK8sNodes';
import PaneK8sNamespace from '@/components/k8s/namespaces/PaneK8sNamespaces';
import PaneK8sDaemonSet from '@/components/k8s/daemonSets/PaneK8sDaemonSets';
import PaneK8sStatefulSet from '@/components/k8s/statefulSets/PaneK8sStatefulSets';
import PaneK8sReplicaSet from '@/components/k8s/replicaSets/PaneK8sReplicaSets';
import PaneK8sReplicationController from '@/components/k8s/replicationControllers/PaneK8sReplicationControllers';
import PaneK8sJob from '@/components/k8s/jobs/PaneK8sJobs';
import PaneK8sCronJob from '@/components/k8s/cronJobs/PaneK8sCronJobs';
import PaneK8sConfigMap from '@/components/k8s/configMaps/PaneK8sConfigMaps';
import PaneK8sSecret from '@/components/k8s/secrets/PaneK8sSecrets';
import PaneK8sResourceQuota from '@/components/k8s/resourceQuotas/PaneK8sResourceQuotas';
import PaneK8sLimitRanges from '@/components/k8s/limitRanges/PaneK8sLimitRanges';
import PaneK8sHorizontalPodAutoscalers from '@/components/k8s/horizontalPodAutoscalers/PaneK8sHorizontalPodAutoscalers';
import PaneK8sPodDisruptionBudgets from '@/components/k8s/podDisruptionBudgets/PaneK8sPodDisruptionBudgets';
import PaneK8sDeployment from '@/components/k8s/deployments/PaneK8sDeployments';
import { SidebarMenu } from '@/components/k8s/menu/SidebarMenu';
import { useNamespaceStore } from '@/store/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';

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

  function Placeholder({ title }: { title: string }) {
    return (
      <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-6">
        <div className="text-white/80">{title}</div>
        <div className="mt-2 text-sm text-white/60">Coming soon...</div>
      </div>
    );
  }

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
          {page === 'overview' && <PaneOverview context={selected} />}
          {page === 'nodes' && <PaneK8sNode context={selected} />}
          {page === 'applications' && <Placeholder title="Applications" />}

          {page === 'workloads_overview' && <Placeholder title="Workloads Overview" />}
          {page === 'deployments' && <PaneK8sDeployment context={selected} />}
          {page === 'daemon_sets' && <PaneK8sDaemonSet context={selected} />}
          {page === 'stateful_sets' && <PaneK8sStatefulSet context={selected} />}
          {page === 'replica_sets' && <PaneK8sReplicaSet context={selected} />}
          {page === 'replication_controllers' && (
            <PaneK8sReplicationController context={selected} />
          )}
          {page === 'jobs' && <PaneK8sJob context={selected} />}
          {page === 'cron_jobs' && <PaneK8sCronJob context={selected} />}
          {page === 'pods' && <PaneK8sPod context={selected} />}

          {page === 'config_maps' && <PaneK8sConfigMap context={selected} />}
          {page === 'secrets' && <PaneK8sSecret context={selected} />}
          {page === 'resource_quotas' && <PaneK8sResourceQuota context={selected} />}
          {page === 'limit_ranges' && <PaneK8sLimitRanges context={selected} />}
          {page === 'horizontal_pod_autoscalers' && (
            <PaneK8sHorizontalPodAutoscalers context={selected} />
          )}
          {page === 'pod_disruption_budgets' && <PaneK8sPodDisruptionBudgets context={selected} />}
          {page === 'priority_classes' && <Placeholder title="Priority Classes" />}
          {page === 'runtime_classes' && <Placeholder title="Runtime Classes" />}
          {page === 'leases' && <Placeholder title="Leases" />}
          {page === 'mutating_webhooks' && <Placeholder title="Mutating Webhook Configurations" />}
          {page === 'validating_webhooks' && (
            <Placeholder title="Validating Webhook Configurations" />
          )}

          {page === 'services' && <Placeholder title="Services" />}
          {page === 'endpoints' && <Placeholder title="Endpoints" />}
          {page === 'ingresses' && <Placeholder title="Ingresses" />}
          {page === 'ingress_classes' && <Placeholder title="Ingress Classes" />}
          {page === 'network_policies' && <Placeholder title="Network Policies" />}
          {page === 'port_forwarding' && <Placeholder title="Port Forwarding" />}

          {page === 'persistent_volume_claims' && <Placeholder title="Persistent Volume Claims" />}
          {page === 'persistent_volumes' && <Placeholder title="Persistent Volumes" />}
          {page === 'storage_classes' && <Placeholder title="Storage Classes" />}

          {page === 'namespaces' && <PaneK8sNamespace context={selected ?? undefined} />}
          {page === 'events' && <Placeholder title="Events" />}

          {page === 'helm_charts' && <Placeholder title="Helm Charts" />}
          {page === 'helm_releases' && <Placeholder title="Helm Releases" />}

          {page === 'service_accounts' && <Placeholder title="Service Accounts" />}
          {page === 'cluster_roles' && <Placeholder title="Cluster Roles" />}
          {page === 'roles' && <Placeholder title="Roles" />}
          {page === 'cluster_role_bindings' && <Placeholder title="Cluster Role Bindings" />}
          {page === 'role_bindings' && <Placeholder title="Role Bindings" />}
        </div>
      </main>
    </div>
  );
}
