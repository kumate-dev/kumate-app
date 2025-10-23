import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/layouts/Sidebar';
import PaneOverview from '@/components/custom/PaneOverview';
import PaneK8sPod from '@/components/custom/PaneK8sPod';
import PaneK8sNode from '@/components/custom/PaneK8sNode';
import PaneK8sNamespace from '@/components/custom/PaneK8sNamespace';
import PaneK8sDeployment from '@/components/custom/PaneK8sDeployment';
import PaneK8sDaemonSet from '@/components/custom/PaneK8sDaemonSet';
import PaneK8sStatefulSet from '@/components/custom/PaneK8sStatefulSet';
import PaneK8sReplicaSet from '@/components/custom/PaneK8sReplicaSet';
import PaneK8sReplicationController from '@/components/custom/PaneK8sReplicationController';
import PaneK8sJob from '@/components/custom/PaneK8sJob';
import PaneK8sCronJob from '@/components/custom/PaneK8sCronJob';
import { useNamespaceStore } from '@/state/namespaceStore';
import { PageKey } from '@/types/pageKey';
import { importKubeContexts, K8sContext, listContexts } from '@/services/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import PaneK8sConfigMap from '@/components/custom/PaneK8sConfigMap';
import PaneK8sSecret from '@/components/custom/PaneK8sSecret';
import PaneK8sResourceQuota from '@/components/custom/PaneK8sResourceQuota';
import PaneK8sLimitRange from '@/components/custom/PaneLimitRange';
import PaneK8sHorizontalPodAutoscaler from '@/components/custom/PaneK8sHorizontalPodAutoscaler';

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

          {page === 'workloads-overview' && <Placeholder title="Workloads Overview" />}
          {page === 'deployments' && <PaneK8sDeployment context={selected} />}
          {page === 'daemonsets' && <PaneK8sDaemonSet context={selected} />}
          {page === 'statefulsets' && <PaneK8sStatefulSet context={selected} />}
          {page === 'replicasets' && <PaneK8sReplicaSet context={selected} />}
          {page === 'replicationcontrollers' && <PaneK8sReplicationController context={selected} />}
          {page === 'jobs' && <PaneK8sJob context={selected} />}
          {page === 'cronjobs' && <PaneK8sCronJob context={selected} />}
          {page === 'pods' && <PaneK8sPod context={selected} />}

          {page === 'configmaps' && <PaneK8sConfigMap context={selected} />}
          {page === 'secrets' && <PaneK8sSecret context={selected} />}
          {page === 'resourcequotas' && <PaneK8sResourceQuota context={selected} />}
          {page === 'limitranges' && <PaneK8sLimitRange context={selected} />}
          {page === 'hpas' && <PaneK8sHorizontalPodAutoscaler context={selected} />}
          {page === 'pdbs' && <Placeholder title="Pod Disruption Budgets" />}
          {page === 'priorityclasses' && <Placeholder title="Priority Classes" />}
          {page === 'runtimeclasses' && <Placeholder title="Runtime Classes" />}
          {page === 'leases' && <Placeholder title="Leases" />}
          {page === 'mutatingwebhooks' && <Placeholder title="Mutating Webhook Configurations" />}
          {page === 'validatingwebhooks' && (
            <Placeholder title="Validating Webhook Configurations" />
          )}

          {page === 'services' && <Placeholder title="Services" />}
          {page === 'endpoints' && <Placeholder title="Endpoints" />}
          {page === 'ingresses' && <Placeholder title="Ingresses" />}
          {page === 'ingressclasses' && <Placeholder title="Ingress Classes" />}
          {page === 'networkpolicies' && <Placeholder title="Network Policies" />}
          {page === 'portforwarding' && <Placeholder title="Port Forwarding" />}

          {page === 'persistentvolumeclaims' && <Placeholder title="Persistent Volume Claims" />}
          {page === 'persistentvolumes' && <Placeholder title="Persistent Volumes" />}
          {page === 'storageclasses' && <Placeholder title="Storage Classes" />}

          {page === 'namespaces' && <PaneK8sNamespace context={selected ?? undefined} />}
          {page === 'events' && <Placeholder title="Events" />}

          {page === 'helm-charts' && <Placeholder title="Helm Charts" />}
          {page === 'helm-releases' && <Placeholder title="Helm Releases" />}

          {page === 'serviceaccounts' && <Placeholder title="Service Accounts" />}
          {page === 'clusterroles' && <Placeholder title="Cluster Roles" />}
          {page === 'roles' && <Placeholder title="Roles" />}
          {page === 'clusterrolebindings' && <Placeholder title="Cluster Role Bindings" />}
          {page === 'rolebindings' && <Placeholder title="Role Bindings" />}
        </div>
      </main>
    </div>
  );
}
