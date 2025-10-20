import { useState, useMemo } from "react";
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from "../ui";
import { relativeAge } from "../../utils/time";
import { suspendVariant } from "../../utils/k8s";
import { useNamespaceStore, ALL } from "../../state/namespaceStore";
import { K8sContext } from "../../layouts/Sidebar";
import { useNamespaces } from "../../hooks/useNamespaces";
import { useCronJobs } from "../../hooks/useCronJobs";

interface PaneCronJobProps {
  context?: K8sContext | null;
}

export default function PaneCronJob({ context }: PaneCronJobProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useNamespaces(context);
  const nsParam = selectedNs === ALL ? undefined : selectedNs;
  const { items, loading, error } = useCronJobs(context, nsParam);

  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((n) => (n.name || "").toLowerCase().includes(term));
  }, [items, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Namespace</span>
          <select
            value={selectedNs}
            onChange={(e) => setSelectedNs(e.target.value)}
            className="bg-white/10 text-white text-xs rounded px-2 py-1"
          >
            <option value={ALL}>{ALL}</option>
            {namespaceList.map((ns) => (
              <option key={ns.name} value={ns.name}>{ns.name}</option>
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

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-200 p-2 text-sm">{error}</div>}

      <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Schedule</Th>
              <Th>Suspend</Th>
              <Th>Last Schedule</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && <Tr><Td colSpan={7} className="text-white/60">Loading...</Td></Tr>}
            {!loading && filtered.length === 0 && <Tr><Td colSpan={7} className="text-white/60">No cronjobs</Td></Tr>}
            {!loading && filtered.map((d) => (
              <Tr key={d.name}>
                <Td className="font-medium">{d.name}</Td>
                <Td className="text-white/80">{d.namespace}</Td>
                <Td className="text-white/80">{d.schedule}</Td>
                <Td><Badge variant={suspendVariant(d.suspend)}>{String(d.suspend)}</Badge></Td>
                <Td className="text-white/80">{d.last_schedule ? relativeAge(d.last_schedule) : "-"}</Td>
                <Td className="text-white/80">{relativeAge(d.creation_timestamp)}</Td>
                <Td><button className="text-white/60 hover:text-white/80">⋮</button></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
