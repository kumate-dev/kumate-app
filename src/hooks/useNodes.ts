import { useEffect, useState } from "react";
import { listNodes } from "../services/k8s";
import { K8sContext } from "../layouts/Sidebar";

export interface Node {
  name: string;
  cpu?: string;
  memory?: string;
  disk?: string;
  taints?: string;
  roles?: string;
  version?: string;
  age?: string;
  condition?: string;
}

export function useNodes(context?: K8sContext | null) {
  const [items, setItems] = useState<Node[]>([]);
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

    async function fetchNodes() {
      setLoading(true);
      setError("");
      try {
        const res = await withTimeout(listNodes({ name }), 15000);
        if (active) setItems(Array.isArray(res) ? (res as Node[]) : []);
      } catch (e: any) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchNodes();
    return () => { active = false; };
  }, [context?.name]);

  return { items, loading, error };
}
