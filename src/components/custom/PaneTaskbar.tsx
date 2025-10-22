import { ALL_NAMESPACES } from '@/constants/k8s';
import { PaneSearch } from '@/components/custom/PaneSearch';
import { Check } from 'lucide-react';
import { PaneDropdown } from '@/components/custom/PaneDropdown';
import DropdownTrigger from '@/components/ui/dropdown';

interface NamespaceOption {
  name: string;
}

interface PaneTaskbarProps {
  namespaceList: NamespaceOption[];
  selectedNamespaces: string[];
  onSelectNamespace: (ns: string[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showNamespace?: boolean;
}

export function PaneTaskbar({
  namespaceList,
  selectedNamespaces,
  onSelectNamespace,
  query,
  onQueryChange,
  showNamespace = true,
}: PaneTaskbarProps) {
  const toggleNamespace = (ns: string) => {
    if (ns === ALL_NAMESPACES) {
      onSelectNamespace([ALL_NAMESPACES]);
    } else {
      let next = selectedNamespaces.includes(ALL_NAMESPACES)
        ? [ns]
        : selectedNamespaces.includes(ns)
          ? selectedNamespaces.filter((s) => s !== ns)
          : [...selectedNamespaces, ns];
      if (!next.length) next = [ALL_NAMESPACES];
      onSelectNamespace(next);
    }
  };

  const displayLabel = selectedNamespaces.includes(ALL_NAMESPACES)
    ? ALL_NAMESPACES
    : selectedNamespaces.join(', ');

  return (
    <div className="sticky top-0 z-20 mb-4 flex items-center gap-2 py-2">
      {showNamespace && (
        <PaneDropdown trigger={<DropdownTrigger label={displayLabel} className="w-80" />}>
          {[ALL_NAMESPACES, ...namespaceList.map((ns) => ns.name)].map((ns) => (
            <div
              key={ns}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
              onClick={() => toggleNamespace(ns)}
            >
              <Check
                className={`h-4 w-4 text-green-400 ${
                  selectedNamespaces.includes(ns) ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <span className="truncate text-xs text-white">{ns}</span>
            </div>
          ))}
        </PaneDropdown>
      )}

      <PaneSearch
        query={query}
        onQueryChange={onQueryChange}
        className="max-w-xs min-w-0 flex-shrink"
      />
    </div>
  );
}
