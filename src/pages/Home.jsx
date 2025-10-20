import { useEffect, useState } from "react";
import Sidebar from "../layouts/Sidebar";
import PaneOverview from "../components/custom/PaneOverview";
import WorkloadsPane from "../components/custom/PanePods";
import PaneNodes from "../components/custom/PaneNodes";
import { listContexts, getContextSecrets, deleteContext as svcDeleteContext, importKubeContexts } from "../services/k8s";
import PaneNamespaces from "../components/custom/PaneNamespaces";
import PaneDeployments from "../components/custom/PaneDeployments";
import PaneDaemonSets from "../components/custom/PaneDaemonSets";
import PaneStatefulSets from "../components/custom/PaneStatefulSets";
import PaneReplicaSets from "../components/custom/PaneReplicaSets";
import PaneReplicationControllers from "../components/custom/PaneReplicationControllers";
import PaneJobs from "../components/custom/PaneJobs";
import PaneCronJob from "../components/custom/PaneCronJob";
import { useNamespaceStore } from "../state/namespaceStore";

export default function Dashboard() {
  const [contexts, setContexts] = useState([]);
  const [_, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [page, setPage] = useState("overview");

  const ALL = "All Namespaces";
  const resetNsToAll = () => useNamespaceStore.setState({ selectedNs: ALL });

  function Placeholder({ title }) {
    return (
      <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-6">
        <div className="text-white/80">{title}</div>
        <div className="text-white/60 text-sm mt-2">Chưa triển khai. Sẽ dựng giống Lens.</div>
      </div>
    );
  }

  async function fetchContexts() {
    setError("");
    setLoading(true);
    try {
      let list = [];
      try {
        list = (await listContexts()) || [];
      } catch (_) {
        setContexts([]);
        setSelected(null);
        setError("Please run Tauri app to list clusters.");
        return;
      }

      if (list.length === 0) {
        try { await importKubeContexts(); } catch (_) {}
        try { list = (await listContexts()) || []; } catch (_) {}
      }
      setContexts(list);
      if (!selected && list.length > 0) setSelected(list[0]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchContexts();
  }, []);

  // Reset namespace in store when context changes
  useEffect(() => {
    if (selected?.name) resetNsToAll();
  }, [selected?.name]);


  async function showSecrets(name) {
    setError("");
    try {
      const [kubeconfig, token] = await getContextSecrets(name);
      alert(`Token: ${token}\n\nKubeconfig:\n${kubeconfig}`);
    } catch (e) {
      setError(String(e));
    }
  }

  async function deleteContext(name) {
    setError("");
    try {
      await svcDeleteContext(name);
      await fetchContexts();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="h-screen bg-neutral-950 text-white flex">
      <Sidebar
        contexts={contexts}
        selected={selected}
        onSelectContext={(c) => { setSelected(c); setPage("overview"); }}
        page={page}
        onSelectPage={setPage}
      />

      <div className="flex-1 relative">
        {error && (
          <div className="m-4 bg-red-500/10 text-red-400 p-2 rounded border border-red-400/30">{error}</div>
        )}

        <div className="h-full overflow-auto p-4">

          {page === "overview" && (
            <PaneOverview context={selected} onShowSecrets={showSecrets} onDelete={deleteContext} />
          )}
          {page === "nodes" && (
            <PaneNodes context={selected} />
          )}
          {page === "applications" && <Placeholder title="Applications" />}

          {page === "workloads-overview" && <Placeholder title="Workloads Overview" />}
          {page === "deployments" && (
            <PaneDeployments context={selected} />
          )}
          {page === "daemonsets" && (
            <PaneDaemonSets context={selected} />
          )}
          {page === "statefulsets" && (
            <PaneStatefulSets context={selected} />
          )}
          {page === "replicasets" && (
            <PaneReplicaSets context={selected} />
          )}
          {page === "replicationcontrollers" && (
            <PaneReplicationControllers context={selected} />
          )}
          {page === "jobs" && (
            <PaneJobs context={selected} />
          )}
          {page === "cronjobs" && (
            <PaneCronJob context={selected} />
          )}

          {page === "pods" && (
            <WorkloadsPane context={selected} />
          )}

          {page === "services" && <Placeholder title="Services" />}
          {page === "endpoints" && <Placeholder title="Endpoints" />}
          {page === "ingresses" && <Placeholder title="Ingresses" />}
          {page === "ingressclasses" && <Placeholder title="Ingress Classes" />}
          {page === "networkpolicies" && <Placeholder title="Network Policies" />}
          {page === "portforwarding" && <Placeholder title="Port Forwarding" />}

          {page === "configmaps" && <Placeholder title="Config Maps" />}
          {page === "secrets" && <Placeholder title="Secrets" />}
          {page === "resourcequotas" && <Placeholder title="Resource Quotas" />}
          {page === "limitranges" && <Placeholder title="Limit Ranges" />}
          {page === "hpas" && <Placeholder title="Horizontal Pod Autoscalers" />}
          {page === "pdbs" && <Placeholder title="Pod Disruption Budgets" />}
          {page === "priorityclasses" && <Placeholder title="Priority Classes" />}
          {page === "runtimeclasses" && <Placeholder title="Runtime Classes" />}
          {page === "leases" && <Placeholder title="Leases" />}
          {page === "mutatingwebhooks" && <Placeholder title="Mutating Webhook Configurations" />}
          {page === "validatingwebhooks" && <Placeholder title="Validating Webhook Configurations" />}

          {page === "persistentvolumeclaims" && <Placeholder title="Persistent Volume Claims" />}
          {page === "persistentvolumes" && <Placeholder title="Persistent Volumes" />}
          {page === "storageclasses" && <Placeholder title="Storage Classes" />}

          {page === "namespaces" && (
            <PaneNamespaces context={selected} />
          )}
          {page === "events" && <Placeholder title="Events" />}

          {page === "helm-charts" && <Placeholder title="Helm Charts" />}
          {page === "helm-releases" && <Placeholder title="Helm Releases" />}

          {page === "serviceaccounts" && <Placeholder title="Service Accounts" />}
          {page === "clusterroles" && <Placeholder title="Cluster Roles" />}
          {page === "roles" && <Placeholder title="Roles" />}
          {page === "clusterrolebindings" && <Placeholder title="Cluster Role Bindings" />}
          {page === "rolebindings" && <Placeholder title="Role Bindings" />}
        </div>

        <button
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-white/10 border border-white/20 hover:bg-white/15"
          onClick={() => setOpenAdd(true)}
          aria-label="Add"
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      </div>
    </div>
  );
}
