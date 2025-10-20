import { useEffect, useMemo, useState } from "react";
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from "../ui";
import { listPods, listNamespaces, watchPods, unwatchPods } from "../../services/k8s";
import { relativeAge } from "../../utils/time";
import { podStatusVariant } from "../../utils/k8s";
import { useNamespaceStore } from "../../state/namespaceStore";

export default function WorkloadsPane({ context }) {
  const ALL = "All Namespaces";
  const namespaces = useNamespaceStore((s) => s.namespaces);
  const namespacesContext = useNamespaceStore((s) => s.namespacesContext);
  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [ageTick, setAgeTick] = useState(0);

  // Force re-render every minute to update age counters
  useEffect(() => {
    const t = setInterval(() => setAgeTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Fetch namespaces for dropdown
  useEffect(() => {
    let active = true;
    async function fetchNamespaces() {
      if (!context?.name) return;
      if ((namespacesContext || null) === (context?.name || null) && (namespaces || []).length > 0) {
        return;
      }
      try {
        const res = await listNamespaces({ name: context.name });
        if (!active) return;
        const nsNames = (res || []).map((n) => n.name).sort();
        setNamespaces(context.name, nsNames);
      } catch (_) {
        // ignore namespace fetching errors in UI; pods pane can still function
      }
    }
    fetchNamespaces();
    return () => { active = false; };
  }, [context?.name, namespacesContext, namespaces.length]);

  // Fetch pods by selected namespace (or all)
  useEffect(() => {
    let active = true;
    const withTimeout = (p, ms) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
      p.then((v) => { clearTimeout(t); resolve(v); })
       .catch((e) => { clearTimeout(t); reject(e); });
    });

    async function fetchPods() {
      if (!context?.name) return;
      setLoading(true);
      setError("");
      try {
        const nsParam = selectedNs === ALL ? null : selectedNs;
        const res = await withTimeout(listPods({ name: context.name, namespace: nsParam }), 15000);
        if (active) setPods(res || []);
      } catch (e) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchPods();
    return () => { active = false; };
  }, [context?.name, selectedNs]);

  // Start watch for pods to get real-time updates
  useEffect(() => {
    let active = true;
    let unlisten = null;
    const keyOf = (x) => `${x?.namespace || ""}/${x?.name || ""}`;
    async function startWatch() {
      if (!context?.name) return;
      const nsParam = selectedNs === ALL ? null : selectedNs;
      try {
        const { unlisten: u } = await watchPods({ name: context.name, namespace: nsParam, onEvent: (payload) => {
          if (!active) return;
          if (payload?.event === "ERROR") {
            setError(String(payload?.message || "Watch error"));
            return;
          }
          const { event, item } = payload || {};
          setPods((prev) => {
            const map = new Map(prev.map((p) => [keyOf(p), p]));
            const k = keyOf(item || {});
            if (event === "DELETED") {
              if (k) map.delete(k);
            } else if (k) {
              map.set(k, item);
            }
            return Array.from(map.values());
          });
        }});
        unlisten = u;
      } catch (e) {
        // Swallow watch start errors; UI still has polling fallback
      }
    }
    startWatch();
    return () => {
      active = false;
      try {
        const nsParam = selectedNs === ALL ? null : selectedNs;
        if (unlisten) unlisten();
        if (context?.name) unwatchPods({ name: context.name, namespace: nsParam });
      } catch (_) {}
    };
  }, [context?.name, selectedNs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pods;
    return (pods || []).filter((p) => (p.name || "").toLowerCase().includes(term));
  }, [pods, q, ageTick]);

  const dotClass = (s) => {
    if (s === "Running") return "bg-green-500";
    if (s === "Waiting") return "bg-yellow-500";
    if (s === "Terminated" || s === "Failed") return "bg-red-500";
    return "bg-white/40";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Namespace</span>
          <select
            value={selectedNs}
            onChange={(e) => { const ns = e.target.value; setSelectedNs(ns); }}
            className="bg-white/10 text-white text-xs rounded px-2 py-1"
          >
            <option value={ALL}>{ALL}</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
        <Input
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-200 p-2 text-sm">{error}</div>
      )}

      <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Containers</Th>
              <Th>CPU</Th>
              <Th>Memory</Th>
              <Th>Restart</Th>
              <Th>Node</Th>
              <Th>QoS</Th>
              <Th>Age</Th>
              <Th>Status</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr><Td colSpan={11} className="text-white/60">Loading...</Td></Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr><Td colSpan={11} className="text-white/60">No pods</Td></Tr>
            )}
            {!loading && filtered.map((p) => (
              <Tr key={`${p.namespace}/${p.name}`}>
                <Td className="font-medium">{p.name}</Td>
                <Td className="text-white/80">{p.namespace}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {(p.container_states || []).length > 0 ? (
                      (p.container_states || []).map((st, idx) => (
                        <span key={idx} className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(st)}`}></span>
                      ))
                    ) : (
                      Array.from({ length: p.containers || 0 }).map((_, idx) => (
                        <span key={idx} className="inline-block h-2.5 w-2.5 rounded-full bg-white/30"></span>
                      ))
                    )}
                  </div>
                </Td>
                <Td className="text-white/80">{p.cpu || "-"}</Td>
                <Td className="text-white/80">{p.memory || "-"}</Td>
                <Td className="text-white/80">{(p.restart ?? "-")}</Td>
                <Td className="text-white/80">{p.node || "-"}</Td>
                <Td className="text-white/80">{p.qos || "-"}</Td>
                <Td className="text-white/80">{relativeAge(p.creation_timestamp)}</Td>
                <Td><Badge variant={podStatusVariant(p.phase)}>{p.phase || "Unknown"}</Badge></Td>
                <Td>
                  <button className="text-white/60 hover:text-white/80">⋮</button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}