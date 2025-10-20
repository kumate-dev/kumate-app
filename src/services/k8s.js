import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export async function listContexts() {
  return invoke("list_contexts");
}

export async function addContext(payload) {
  return invoke("add_context", { payload });
}

export async function deleteContext(name) {
  return invoke("delete_context", { name });
}

export async function getContextSecrets(name) {
  return invoke("get_context_secrets", { name });
}

export async function listPods({ name, namespace }) {
  return invoke("list_pods", { name, namespace });
}

export async function listDeployments({ name, namespace }) {
  return invoke("list_deployments", { name, namespace });
}

export async function listDaemonSets({ name, namespace }) {
  return invoke("list_daemonsets", { name, namespace });
}

export async function listNamespaces({ name }) {
  return invoke("list_namespaces", { name });
}

export async function watchNamespaces({ name, onEvent }) {
  const eventName = await invoke("watch_namespaces", { name });
  const unlisten = await listen(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error("Error in onEvent handler:", err);
    }
  });
  return { eventName, unlisten };
}

export async function unwatchNamespaces({ name }) {
  try {
    await invoke("unwatch_namespaces", { name });
  } catch (err) {
    console.warn("unwatchNamespaces failed:", err);
  }
}

export async function listNodes({ name }) {
  return invoke("list_nodes", { name });
}

export async function listStatefulSets({ name, namespace }) {
  return invoke("list_statefulsets", { name, namespace });
}

export async function listReplicaSets({ name, namespace }) {
  return invoke("list_replicasets", { name, namespace });
}

export async function listReplicationControllers({ name, namespace }) {
  return invoke("list_replicationcontrollers", { name, namespace });
}

export async function listJobs({ name, namespace }) {
  return invoke("list_jobs", { name, namespace });
}

export async function listCronJobs({ name, namespace }) {
  return invoke("list_cronjobs", { name, namespace });
}

export async function importKubeContexts() {
  return invoke("import_kube_contexts");
}

export async function watchPods({ name, namespace, onEvent }) {
  const eventName = await invoke("watch_pods", { name, namespace });
  const unlisten = await listen(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (_) {
      // swallow handler errors
    }
  });
  return { eventName, unlisten };
}

export async function unwatchPods({ name, namespace }) {
  try {
    await invoke("unwatch_pods", { name, namespace });
  } catch (_) {
    // ignore errors when unwatching
  }
}