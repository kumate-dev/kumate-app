import { useEffect, useState } from "react";
import { K8sContext } from "../layouts/Sidebar";

export function useK8sResources<T>(
    listFn: (params: { name: string; namespace?: string }) => Promise<T[]>,
    context?: K8sContext | null,
    namespace?: string,
    timeoutMs = 15000
) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!context?.name || !listFn) return;
        const name = context.name;

        let active = true;

        const withTimeout = <U,>(p: Promise<U>, ms: number) =>
            new Promise<U>((resolve, reject) => {
                const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
                p.then(v => { clearTimeout(t); resolve(v); })
                    .catch(e => { clearTimeout(t); reject(e); });
            });

        async function fetchData() {
            setLoading(true);
            setError("");
            try {
                const nsParam = namespace && namespace !== "All Namespaces" ? namespace : undefined;
                const res = await withTimeout(listFn({ name, namespace: nsParam }), timeoutMs);
                if (active) setItems(res || []);
            } catch (e: any) {
                if (active) setError(e?.message || String(e));
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchData();
        return () => { active = false; };
    }, [context?.name, namespace, listFn, timeoutMs]);

    return { items, loading, error };
}
