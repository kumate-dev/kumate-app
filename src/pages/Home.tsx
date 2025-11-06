import { useEffect, useRef, useState, useCallback } from 'react';
import { LeftSidebarMenu } from '@/features/k8s/generic/components/LeftSidebarMenu';
import { useNamespaceStore } from '@/store/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import Overview from '@/features/k8s/overview/components/Overview';
import ComingSoon from './ComingSoon';
import Pods from '@/features/k8s/pods/pages/Pods';
import ConfigMaps from '@/features/k8s/configMaps/pages/ConfigMaps';
import CronJobs from '@/features/k8s/cronJobs/pages/CronJobs';
import DaemonSets from '@/features/k8s/daemonSets/pages/DaemonSets';
import Deployments from '@/features/k8s/deployments/pages/Deployments';
import HorizontalPodAutoscalers from '@/features/k8s/horizontalPodAutoscalers/pages/HorizontalPodAutoscalers';
import Jobs from '@/features/k8s/jobs/pages/Jobs';
import LimitRanges from '@/features/k8s/limitRanges/pages/LimitRanges';
import Namespaces from '@/features/k8s/namespaces/pages/Namespaces';
import Nodes from '@/features/k8s/nodes/pages/Nodes';
import PodDisruptionBudgets from '@/features/k8s/podDisruptionBudgets/pages/PodDisruptionBudgets';
import ReplicaSets from '@/features/k8s/replicaSets/pages/ReplicaSets';
import ReplicationControllers from '@/features/k8s/replicationControllers/pages/ReplicationControllers';
import Secrets from '@/features/k8s/secrets/pages/Secrets';
import StatefulSets from '@/features/k8s/statefulSets/pages/StatefulSets';
import ResourceQuotas from '@/features/k8s/resourceQuotas/pages/ResourceQuotas';
import Services from '@/features/k8s/services/pages/Services';
import PersistentVolumeClaims from '@/features/k8s/persistentVolumeClaims/pages/PersistentVolumeClaims';
import PriorityClasses from '@/features/k8s/priorityClasses/pages/PriorityClasses';
import RuntimeClasses from '@/features/k8s/runtimeClasses/pages/RuntimeClasses';
import Leases from '@/features/k8s/leases/pages/Leases';
import MutatingWebhooks from '@/features/k8s/mutatingWebhooks/pages/MutatingWebhooks';
import ValidatingWebhooks from '@/features/k8s/validatingWebhooks/pages/ValidatingWebhooks';
import Endpoints from '@/features/k8s/endpoints/pages/Endpoints';
import Ingresses from '@/features/k8s/ingresses/pages/Ingresses';
import IngressClasses from '@/features/k8s/ingressClasses/pages/IngressClasses';
import NetworkPolicies from '@/features/k8s/networkPolicies/pages/NetworkPolicies';
import PersistentVolumes from '@/features/k8s/persistentVolumes/pages/PersistentVolumes';
import StorageClasses from '@/features/k8s/storageClasses/pages/StorageClasses';
import ServiceAccounts from '@/features/k8s/serviceAccounts/pages/ServiceAccounts';
import Roles from '@/features/k8s/roles/pages/Roles';
import RoleBindings from '@/features/k8s/roleBindings/pages/RoleBindings';
import ClusterRoles from '@/features/k8s/clusterRoles/pages/ClusterRoles';
import ClusterRoleBindings from '@/features/k8s/clusterRoleBindings/pages/ClusterRoleBindings';
import HelmCharts from '@/features/k8s/helmCharts/pages/HelmCharts';
import HelmReleases from '@/features/k8s/helmReleases/pages/HelmReleases';
import Definitions from '@/features/k8s/customResources/pages/Definitions';
import PortForwarding from '@/features/k8s/portForwarding/pages/PortForwarding';

export default function Home() {
  const [contexts, setContexts] = useState<K8sContext[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<K8sContext | null>(null);
  const [page, setPage] = useState<PageKey>('overview');

  const resetNsToAll = () => useNamespaceStore.setState({ selectedNamespaces: [ALL_NAMESPACES] });
  const selectedRef = useRef(selected);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const handleMainWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const canScroll = el.scrollHeight > el.clientHeight;

    if (!canScroll) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const delta = e.deltaY;
    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

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
    nodes: Nodes,
    namespaces: Namespaces,

    // Workloads
    pods: Pods,
    deployments: Deployments,
    replica_sets: ReplicaSets,
    daemon_sets: DaemonSets,
    stateful_sets: StatefulSets,
    replication_controllers: ReplicationControllers,
    jobs: Jobs,
    cron_jobs: CronJobs,

    // Configs
    config_maps: ConfigMaps,
    secrets: Secrets,
    resource_quotas: ResourceQuotas,
    limit_ranges: LimitRanges,
    horizontal_pod_autoscalers: HorizontalPodAutoscalers,
    pod_disruption_budgets: PodDisruptionBudgets,
    priority_classes: PriorityClasses,
    runtime_classes: RuntimeClasses,
    leases: Leases,
    mutating_webhooks: MutatingWebhooks,
    validating_webhooks: ValidatingWebhooks,

    // Network
    services: Services,
    endpoints: Endpoints,
    ingresses: Ingresses,
    ingress_classes: IngressClasses,
    network_policies: NetworkPolicies,
    port_forwarding: PortForwarding,

    // Storage
    persistent_volume_claims: PersistentVolumeClaims,
    persistent_volumes: PersistentVolumes,
    storage_classes: StorageClasses,

    // Access Control
    service_accounts: ServiceAccounts,
    roles: Roles,
    role_bindings: RoleBindings,
    cluster_roles: ClusterRoles,
    cluster_role_bindings: ClusterRoleBindings,

    // Helm
    helm_charts: HelmCharts,
    helm_releases: HelmReleases,

    // Custom Resources
    custom_resource_definitions: Definitions,
  };

  const PageComponent = pageComponents[page] || ComingSoon;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-white">
      <aside className="w-64 flex-shrink-0 overflow-y-auto overscroll-none border-r border-white/10">
        <LeftSidebarMenu
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

        <div
          ref={mainScrollRef}
          className="h-full overflow-y-auto overscroll-none p-4"
          onWheelCapture={handleMainWheelCapture}
        >
          <PageComponent context={selected ?? undefined} />
        </div>
      </main>
    </div>
  );
}
