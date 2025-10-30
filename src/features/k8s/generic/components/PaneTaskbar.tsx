import { ALL_NAMESPACES } from '@/constants/k8s';
import { Search } from '@/components/common/Search';
import { Check } from 'lucide-react';
import { Dropdown } from '@/components/common/Dropdown';
import DropdownTrigger from '@/components/ui/dropdown';
import { V1Namespace } from '@kubernetes/client-node';
import { ButtonCreate } from '@/components/common/ButtonCreate';
import { ButtonTrash } from '@/components/common/ButtonTrash';

interface PaneTaskbarProps {
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showNamespace?: boolean;
  selectedCount?: number;
  onCreate?: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function PaneTaskbar({
  namespaceList = [],
  selectedNamespaces = [ALL_NAMESPACES],
  onSelectNamespace,
  query,
  onQueryChange,
  showNamespace = true,
  selectedCount = 0,
  onCreate,
  onDelete,
}: PaneTaskbarProps) {
  const toggleNamespace = (ns: string) => {
    if (!onSelectNamespace) return;

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
    <div className="relative sticky top-0 z-50 mb-2 flex items-center gap-2 py-2">
      {showNamespace && onSelectNamespace && (
        <Dropdown trigger={<DropdownTrigger label={displayLabel} className="w-80" />}>
          {[ALL_NAMESPACES, ...namespaceList.map((ns) => ns.metadata?.name ?? '')].map((ns) => (
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
        </Dropdown>
      )}

      <Search
        query={query}
        onQueryChange={onQueryChange}
        className="max-w-xs min-w-0 flex-shrink"
      />

      <div className="ml-auto flex items-center gap-2">
        {selectedCount > 0 && onDelete && <ButtonTrash onDelete={onDelete} />}
        {onCreate && <ButtonCreate onCreate={onCreate} />}
      </div>
    </div>
  );
}
