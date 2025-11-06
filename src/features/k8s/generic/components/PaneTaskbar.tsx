import { ALL_NAMESPACES } from '@/constants/k8s';
import { Search } from '@/components/common/Search';
import { Check } from 'lucide-react';
import { Dropdown } from '@/components/common/Dropdown';
import DropdownTrigger from '@/components/ui/dropdown';
import { V1Namespace } from '@kubernetes/client-node';
import { ButtonCreate } from '@/components/common/ButtonCreate';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { useCallback, useMemo } from 'react';

interface PaneTaskbarProps {
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showNamespace?: boolean;
  selectedCount?: number;
  onCreate?: () => void;
  onDelete?: () => void;
  creating?: boolean;
  deleting?: boolean;
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
  creating = false,
  deleting = false,
}: PaneTaskbarProps) {
  const toggleNamespace = useCallback(
    (namespace: string) => {
      if (!onSelectNamespace) return;

      if (namespace === ALL_NAMESPACES) {
        onSelectNamespace([ALL_NAMESPACES]);
      } else {
        const currentIncludesAll = selectedNamespaces.includes(ALL_NAMESPACES);
        const currentIncludesNamespace = selectedNamespaces.includes(namespace);

        let nextNamespaces: string[];

        if (currentIncludesAll) {
          nextNamespaces = [namespace];
        } else if (currentIncludesNamespace) {
          nextNamespaces = selectedNamespaces.filter((ns) => ns !== namespace);
        } else {
          nextNamespaces = [...selectedNamespaces, namespace];
        }

        if (nextNamespaces.length === 0) {
          nextNamespaces = [ALL_NAMESPACES];
        }

        onSelectNamespace(nextNamespaces);
      }
    },
    [onSelectNamespace, selectedNamespaces]
  );

  const displayLabel = useMemo(
    () =>
      selectedNamespaces.includes(ALL_NAMESPACES) ? ALL_NAMESPACES : selectedNamespaces.join(', '),
    [selectedNamespaces]
  );

  const namespaceOptions = useMemo(
    () => [ALL_NAMESPACES, ...namespaceList.map((ns) => ns.metadata?.name ?? '').filter(Boolean)],
    [namespaceList]
  );

  const hasSelectedItems = selectedCount > 0;
  const canShowNamespace = showNamespace && onSelectNamespace;

  return (
    <div className="relative sticky top-0 z-50 mb-2 flex items-center gap-2 py-2">
      {canShowNamespace && (
        <Dropdown trigger={<DropdownTrigger label={displayLabel} className="w-80" />}>
          {namespaceOptions.map((namespace) => (
            <div
              key={namespace}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
              onClick={() => toggleNamespace(namespace)}
            >
              <Check
                className={`h-4 w-4 text-green-400 ${
                  selectedNamespaces.includes(namespace) ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <span className="truncate text-xs text-white">{namespace}</span>
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
        {hasSelectedItems && onDelete && (
          <ButtonTrash onClick={onDelete} disabled={deleting} loading={deleting} />
        )}
        {onCreate && <ButtonCreate onClick={onCreate} disabled={creating} loading={creating} />}
      </div>
    </div>
  );
}
