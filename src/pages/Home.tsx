import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '../layouts/Sidebar';
import PaneOverview from '../components/custom/PaneOverview';
import WorkloadsPane from '../components/custom/PanePods';
import PaneNodes from '../components/custom/PaneNodes';
import { listContexts, importKubeContexts } from '../services/k8s';
import PaneNamespaces from '../components/custom/PaneNamespaces';
import PaneDeployments from '../components/custom/PaneDeployments';
import PaneDaemonSets from '../components/custom/PaneDaemonSets';
import PaneStatefulSets from '../components/custom/PaneStatefulSets';
import PaneReplicaSets from '../components/custom/PaneReplicaSets';
import PaneReplicationControllers from '../components/custom/PaneReplicationControllers';
import PaneJobs from '../components/custom/PaneJobs';
import PaneCronJob from '../components/custom/PaneCronJob';
import { useNamespaceStore } from '../state/namespaceStore';
import { PageKey } from '../types/pageKey';

interface KubeContext {
  name: string;
}

export default function Dashboard() {
  const [contexts, setContexts] = useState<KubeContext[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<KubeContext | null>(null);
  const [_, setOpenAdd] = useState(false);
  const [page, setPage] = useState<PageKey>('overview');

  const ALL_NAMESPACES = 'All Namespaces';
  const resetNsToAll = () => useNamespaceStore.setState({ selectedNs: ALL_NAMESPACES });

  function Placeholder({ title }: { title: string }) {
    return (
      <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-6">
        <div className="text-white/80">{title}</div>
        <div className="mt-2 text-sm text-white/60">Coming soon...</div>
      </div>
    );
  }

  const selectedRef = useRef(selected);

  useEffect(() => {
    async function fetchContexts() {
      setError('');
      setLoading(true);
      try {
        let list: KubeContext[] = [];
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

        // dùng ref thay vì selected trực tiếp
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

  return (
    <div className="flex h-screen bg-neutral-950 text-white">
      <Sidebar
        contexts={contexts}
        selected={selected ?? undefined}
        onSelectContext={(c) => {
          setSelected(c ?? null);
          setPage('overview');
        }}
        page={page}
        onSelectPage={(p) => setPage(p as PageKey)}
      />

      <div className="relative flex-1">
        {error && (
          <div className="m-4 rounded border border-red-400/30 bg-red-500/10 p-2 text-red-400">
            {error}
          </div>
        )}

        <div className="h-full overflow-auto p-4">
          {page === 'overview' && <PaneOverview context={selected} />}
          {page === 'nodes' && <PaneNodes context={selected} />}
          {page === 'applications' && <Placeholder title="Applications" />}

          {page === 'workloads-overview' && <Placeholder title="Workloads Overview" />}
          {page === 'deployments' && <PaneDeployments context={selected} />}
          {page === 'daemonsets' && <PaneDaemonSets context={selected} />}
          {page === 'statefulsets' && <PaneStatefulSets context={selected} />}
          {page === 'replicasets' && <PaneReplicaSets context={selected} />}
          {page === 'replicationcontrollers' && <PaneReplicationControllers context={selected} />}
          {page === 'jobs' && <PaneJobs context={selected} />}
          {page === 'cronjobs' && <PaneCronJob context={selected} />}

          {page === 'pods' && <WorkloadsPane context={selected} />}

          {page === 'services' && <Placeholder title="Services" />}
          {page === 'endpoints' && <Placeholder title="Endpoints" />}
          {page === 'ingresses' && <Placeholder title="Ingresses" />}
          {page === 'ingressclasses' && <Placeholder title="Ingress Classes" />}
          {page === 'networkpolicies' && <Placeholder title="Network Policies" />}
          {page === 'portforwarding' && <Placeholder title="Port Forwarding" />}

          {page === 'configmaps' && <Placeholder title="Config Maps" />}
          {page === 'secrets' && <Placeholder title="Secrets" />}
          {page === 'resourcequotas' && <Placeholder title="Resource Quotas" />}
          {page === 'limitranges' && <Placeholder title="Limit Ranges" />}
          {page === 'hpas' && <Placeholder title="Horizontal Pod Autoscalers" />}
          {page === 'pdbs' && <Placeholder title="Pod Disruption Budgets" />}
          {page === 'priorityclasses' && <Placeholder title="Priority Classes" />}
          {page === 'runtimeclasses' && <Placeholder title="Runtime Classes" />}
          {page === 'leases' && <Placeholder title="Leases" />}
          {page === 'mutatingwebhooks' && <Placeholder title="Mutating Webhook Configurations" />}
          {page === 'validatingwebhooks' && (
            <Placeholder title="Validating Webhook Configurations" />
          )}

          {page === 'persistentvolumeclaims' && <Placeholder title="Persistent Volume Claims" />}
          {page === 'persistentvolumes' && <Placeholder title="Persistent Volumes" />}
          {page === 'storageclasses' && <Placeholder title="Storage Classes" />}

          {page === 'namespaces' && <PaneNamespaces context={selected ?? undefined} />}
          {page === 'events' && <Placeholder title="Events" />}

          {page === 'helm-charts' && <Placeholder title="Helm Charts" />}
          {page === 'helm-releases' && <Placeholder title="Helm Releases" />}

          {page === 'serviceaccounts' && <Placeholder title="Service Accounts" />}
          {page === 'clusterroles' && <Placeholder title="Cluster Roles" />}
          {page === 'roles' && <Placeholder title="Roles" />}
          {page === 'clusterrolebindings' && <Placeholder title="Cluster Role Bindings" />}
          {page === 'rolebindings' && <Placeholder title="Role Bindings" />}
        </div>

        <button
          className="absolute right-4 bottom-4 h-10 w-10 rounded-full border border-white/20 bg-white/10 hover:bg-white/15"
          onClick={() => setOpenAdd(true)}
          aria-label="Add"
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      </div>
    </div>
  );
}
