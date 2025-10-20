import { useEffect, useState } from "react";
import { listStatefulSets } from "../services/k8s";
import { K8sContext } from "../layouts/Sidebar";

export interface StatefulSet {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp: string;
}

export function useStatefulSets(context?: K8sContext | null, namespace?: string) {
  const [items, setItems] = useState<StatefulSet[]>([]);
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

    async function fetchStatefulSets() {
      setLoading(true);
      setError("");
      try {
        const nsParam = namespace && namespace !== "All Namespaces" ? namespace : "";
        const res = await withTimeout(listStatefulSets({ name, namespace: nsParam }), 15000);
        if (active) setItems(Array.isArray(res) ? (res as StatefulSet[]) : []);
      } catch (e: any) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchStatefulSets();
    return () => { active = false; };
  }, [context?.name, namespace]);

  return { items, loading, error };
}
