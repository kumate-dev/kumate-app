import { useEffect, useMemo, useState } from "react";
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from "../ui";
import { listDaemonSets, listNamespaces } from "../../services/k8s";
import { relativeAge } from "../../utils/time";
import { readyVariant } from "../../utils/k8s";
import { useNamespaceStore } from "../../state/namespaceStore";


export default function PaneDaemonSets({ context }) {
  const ALL = "All Namespaces";
  const namespaces = useNamespaceStore((s) => s.namespaces);
  const namespacesContext = useNamespaceStore((s) => s.namespacesContext);
  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  useEffect(() => {}, []);


  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

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
        // ignore
      }
    }
    fetchNamespaces();
    return () => { active = false; };
  }, [context?.name, namespacesContext, namespaces.length]);

  useEffect(() => {
    let active = true;
    const withTimeout = (p, ms) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
      p.then((v) => { clearTimeout(t); resolve(v); })
       .catch((e) => { clearTimeout(t); reject(e); });
    });

    async function fetch() {
      if (!context?.name) return;
      setLoading(true);
      setError("");
      try {
        const nsParam = selectedNs === ALL ? null : selectedNs;
        const res = await withTimeout(listDaemonSets({ name: context.name, namespace: nsParam }), 15000);
        if (active) setItems(res || []);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetch();
    return () => { active = false; };
  }, [context?.name, selectedNs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return (items || []).filter((n) => (n.name || "").toLowerCase().includes(term));
  }, [items, q]);

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
              <Th>Ready</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr><Td colSpan={5} className="text-white/60">Loading...</Td></Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr><Td colSpan={5} className="text-white/60">No daemonsets</Td></Tr>
            )}
            {!loading && filtered.map((d) => (
              <Tr key={d.name}>
                <Td className="font-medium">{d.name}</Td>
                <Td className="text-white/80">{d.namespace}</Td>
                <Td><Badge variant={readyVariant(d.ready)}>{d.ready}</Badge></Td>
                <Td className="text-white/80">{relativeAge(d.creation_timestamp)}</Td>
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