import { useState, useCallback, useMemo } from 'react';
import { stringify } from 'yaml';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface YamlCollapsibleProps<T extends Record<string, any>> {
  label: string;
  data: T | string | null | undefined;
  truncateLength?: number;
}

export function YamlCollapsible<T extends Record<string, any>>({
  label,
  data,
  truncateLength = 40,
}: YamlCollapsibleProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const { isObject, keys, hasData } = useMemo(() => {
    const isObjectType = typeof data === 'object' && !Array.isArray(data) && data !== null;
    const objectKeys = isObjectType ? Object.keys(data as Record<string, any>) : [];

    return {
      isObject: isObjectType,
      keys: objectKeys,
      hasData: data !== null && data !== undefined,
    };
  }, [data]);

  const collapsedMessage = useMemo(() => {
    if (!hasData) return null;

    if (!isObject) {
      const val = data as string;
      const truncated = val.length > truncateLength ? `${val.slice(0, truncateLength)}...` : val;
      return <pre className="m-0 max-w-full truncate whitespace-pre">{truncated}</pre>;
    }

    if (keys.length === 1) {
      const key = keys[0];
      const value = (data as Record<string, any>)[key];
      const val = stringify({ [key]: value });
      const truncated = val.length > truncateLength ? `${val.slice(0, truncateLength)}...` : val;
      return <pre className="m-0 max-w-full truncate whitespace-pre">{truncated}</pre>;
    }

    return (
      <span>
        {keys.length} {label}s
      </span>
    );
  }, [data, hasData, isObject, keys, label, truncateLength]);

  const shouldShowToggle = isObject && keys.length > 1;
  const shouldShowExpanded = isOpen || keys.length <= 1;
  const shouldShowCollapsed = !isObject || keys.length === 1;

  if (!hasData) {
    return <span className="text-white/60">-</span>;
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      {shouldShowToggle && (
        <button
          type="button"
          onClick={toggle}
          className="mb-1 flex items-center space-x-1 text-gray-400 hover:text-gray-200"
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>
            {keys.length} {label}
            {keys.length !== 1 ? 's' : ''}
          </span>
        </button>
      )}

      <div>
        {shouldShowExpanded ? (
          <pre className="max-w-full overflow-x-auto rounded bg-white/10 p-2 text-xs whitespace-pre text-white">
            {typeof data === 'string' ? data : stringify(data)}
          </pre>
        ) : shouldShowCollapsed ? (
          collapsedMessage
        ) : null}
      </div>
    </div>
  );
}
