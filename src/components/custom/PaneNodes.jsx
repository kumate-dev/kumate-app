import { useEffect, useMemo, useState } from "react";
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from "../ui";
import { listNodes } from "../../services/k8s";
import { relativeAge } from "../../utils/time";
import { conditionVariant } from "../../utils/k8s";


export default function PaneNodes({ context }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

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
        const res = await withTimeout(listNodes({ name: context.name }), 15000);
        if (active) {
          setNodes(res || []);
        }
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetch();
    return () => { active = false; };
  }, [context?.name]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return nodes;
    return (nodes || []).filter((n) => (n.name || "").toLowerCase().includes(term));
  }, [nodes, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
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
              <Th>CPU</Th>
              <Th>Memory</Th>
              <Th>Disk</Th>
              <Th>Taint</Th>
              <Th>Roles</Th>
              <Th>Version</Th>
              <Th>Age</Th>
              <Th>Conditions</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr><Td colSpan={10} className="text-white/60">Loading...</Td></Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr><Td colSpan={10} className="text-white/60">No nodes</Td></Tr>
            )}
            {!loading && filtered.map((n) => (
              <Tr key={n.name}>
                <Td className="font-medium">{n.name}</Td>
                <Td>{n.cpu || "—"}</Td>
                <Td>{n.memory || "—"}</Td>
                <Td>{n.disk || "—"}</Td>
                <Td className="text-white/70">{n.taints || ""}</Td>
                <Td className="text-white/80">{n.roles || ""}</Td>
                <Td className="text-white/80">{n.version || ""}</Td>
                <Td className="text-white/80">{relativeAge(n.age)}</Td>
                <Td><Badge variant={conditionVariant(n.condition)}>{n.condition || "Unknown"}</Badge></Td>
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