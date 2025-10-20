// hooks/usePods.ts
import { useEffect, useState } from "react";
import { listPods } from "../services/k8s";
import { K8sContext } from "../layouts/Sidebar";

export interface Pod {
  name: string;
  namespace: string;
  containers?: number;
  container_states?: string[];
  cpu?: string;
  memory?: string;
  restart?: number;
  node?: string;
  qos?: string;
  creation_timestamp: string;
  phase?: string;
}

export function usePods(context?: K8sContext | null, namespace?: string) {
  const [items, setItems] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!context?.name) return;
    const name = context.name;

    let active = true;

    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
        p.then((v) => { clearTimeout(t); resolve(v); })
         .catch((e) => { clearTimeout(t); reject(e); });
      });

    async function fetchPods() {
      setLoading(true);
      setError("");
      try {
        const nsParam = namespace && namespace !== "All Namespaces" ? namespace : "";
        const res = await withTimeout(listPods({ name, namespace: nsParam }), 15000);
        if (active) setItems(Array.isArray(res) ? (res as Pod[]) : []);
      } catch (e: any) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchPods();
    return () => { active = false; };
  }, [context?.name, namespace]);

  return { items, loading, error };
}
