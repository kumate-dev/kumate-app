import { ALL_NAMESPACES } from '../../constants/k8s';
import { PaneSearch } from './PaneSearch';

interface NamespaceOption {
  name: string;
}

interface PaneTaskbarProps {
  namespaceList: NamespaceOption[];
  selectedNs: string;
  onSelectNamespace: (ns: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showNamespace?: boolean;
}

export function PaneTaskbar({
  namespaceList,
  selectedNs,
  onSelectNamespace,
  query,
  onQueryChange,
  showNamespace = true,
}: PaneTaskbarProps) {
  return (
    <div className="flex items-center justify-between">
      {showNamespace && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Namespace</span>
          <select
            value={selectedNs}
            onChange={(e) => onSelectNamespace(e.target.value)}
            className="rounded bg-white/10 px-2 py-1 text-xs text-white"
          >
            <option value={ALL_NAMESPACES}>{ALL_NAMESPACES}</option>
            {namespaceList.map((ns) => (
              <option key={ns.name} value={ns.name}>
                {ns.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <PaneSearch query={query} onQueryChange={onQueryChange} className="max-w-xs" />
    </div>
  );
}
