import { useState } from 'react';
import yaml from 'js-yaml';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleYamlProps<T extends Record<string, any>> {
  label: string;
  data: T | string | null | undefined;
  truncateLength?: number;
}

export function CollapsibleYaml<T extends Record<string, any>>({
  label,
  data,
  truncateLength = 40,
}: CollapsibleYamlProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  if (!data) return <span className="text-white/60">-</span>;

  const isObject = typeof data === 'object' && !Array.isArray(data);
  const keys = isObject ? Object.keys(data) : [];

  const collapsedMessage = () => {
    if (!isObject) {
      const val = data as string;
      const truncated = val.length > truncateLength ? val.slice(0, truncateLength) + '…' : val;
      return <pre className="m-0 max-w-full truncate whitespace-pre">{truncated}</pre>;
    }

    if (keys.length === 1) {
      const val = yaml.dump({ [keys[0]]: data[keys[0]] });
      const truncated = val.length > truncateLength ? val.slice(0, truncateLength) + '…' : val;
      return <pre className="m-0 max-w-full truncate whitespace-pre">{truncated}</pre>;
    }

    return (
      <span>
        {keys.length} {label}s
      </span>
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col">
      {isObject && keys.length > 1 && (
        <button
          type="button"
          onClick={toggle}
          className="mb-1 flex items-center space-x-1 text-gray-400 hover:text-gray-200"
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>
            {keys.length} {label}{' '}
          </span>
        </button>
      )}
      <div>
        {isOpen || keys.length <= 1 ? (
          <pre className="max-w-full overflow-x-auto rounded bg-white/10 p-2 text-xs whitespace-pre text-white">
            {typeof data === 'string' ? data : yaml.dump(data)}
          </pre>
        ) : !isObject ? (
          collapsedMessage()
        ) : keys.length === 1 ? (
          collapsedMessage()
        ) : null}
      </div>
    </div>
  );
}
