import { useState, useRef, useEffect } from 'react';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { PaneSearch } from '@/components/custom/PaneSearch';
import { Check, ChevronDown } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    <div className="sticky top-0 z-20 flex items-center gap-2">
      {showNamespace && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex w-48 items-center justify-between rounded bg-white/10 px-2 py-1 text-left text-xs text-white"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </button>
          {open && (
            <div className="absolute z-50 mt-1 max-h-60 w-48 overflow-auto rounded border border-white/20 bg-neutral-900 p-1 shadow-lg">
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
            </div>
          )}
        </div>
      )}

      <PaneSearch
        query={query}
        onQueryChange={onQueryChange}
        className="max-w-xs min-w-0 flex-shrink"
      />
    </div>
  );
}
