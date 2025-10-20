import { useEffect, useMemo, useState } from "react";
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from "../ui";
import { listNamespaces, watchNamespaces, unwatchNamespaces } from "../../services/k8s";
import { statusVariant } from "../../utils/k8s";
import { RelativeAge } from "../shared/RelativeAge";


export default function PaneNamespaces({ context }) {
  const [items, setItems] = useState([]);
  const [loading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!context?.name) return;
    let unlisten;

    async function setup() {
      try {
        const initial = await listNamespaces({ name: context.name });
        setItems(initial || []);

        const watcher = await watchNamespaces({
          name: context.name,
          onEvent: (evt) => {
            setItems((prev) => {
              const items = [...prev];
              switch (evt.type) {
                case "ADDED":
                  if (!items.find((i) => i.name === evt.object.name)) {
                    items.push(evt.object);
                  }
                  break;
                case "MODIFIED":
                  return items.map((i) =>
                    i.name === evt.object.name ? evt.object : i
                  );
                case "DELETED":
                  return items.filter((i) => i.name !== evt.object.name);
              }
              return items;
            });
          },
        });
        unlisten = watcher.unlisten;
      } catch (e) {
        setError(e?.message || String(e));
      }
    }

    setup();

    return () => {
      if (unlisten) unlisten();
      unwatchNamespaces({ name: context.name });
      setItems([]);
    };
  }, [context?.name]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return (items || []).filter((n) =>
      (n.name || "").toLowerCase().includes(term)
    );
  }, [items, q]);

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
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-200 p-2 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={4} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-white/60">
                  No namespaces
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((n) => (
                <Tr key={n.name}>
                  <Td className="font-medium">{n.name}</Td>
                  <Td>
                    <Badge variant={statusVariant(n.status)}>
                      {n.status || "Unknown"}
                    </Badge>
                  </Td>
                  <Td className="text-white/80">
                    <RelativeAge iso={n.age} />
                  </Td>
                  <Td>
                    <button className="text-white/60 hover:text-white/80">
                      ⋮
                    </button>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}