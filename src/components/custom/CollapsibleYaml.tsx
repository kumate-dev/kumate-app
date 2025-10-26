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

  const toggle = () => setIsOpen(prev => !prev);

  if (!data) return <span className="text-white/60">-</span>;

  const isObject = typeof data === 'object' && !Array.isArray(data);
  const keys = isObject ? Object.keys(data) : [];

  const collapsedMessage = () => {
    if (!isObject) {
      const val = data as string;
      const truncated = val.length > truncateLength ? val.slice(0, truncateLength) + '…' : val;
      return <pre className="truncate whitespace-pre m-0">{truncated}</pre>;
    }

    if (keys.length === 1) {
      const val = yaml.dump({ [keys[0]]: data[keys[0]] });
      const truncated = val.length > truncateLength ? val.slice(0, truncateLength) + '…' : val;
      return <pre className="truncate whitespace-pre m-0">{truncated}</pre>;
    }

    return <span>{keys.length} {label}s</span>;
  };

  return (
    <div className="flex flex-col w-full">
      {isObject && keys.length > 1 && (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center space-x-1 text-gray-400 hover:text-gray-200 mb-1"
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span>{keys.length} {label} </span>
        </button>
      )}
      <div>
        {isOpen || keys.length <= 1 ? (
          <pre className="overflow-x-auto whitespace-pre text-white text-xs bg-white/10 p-2 rounded">
            {typeof data === 'string' ? data : yaml.dump(data)}
          </pre>
        ) : (
          !isObject ? collapsedMessage() : keys.length === 1 ? collapsedMessage() : null
        )}
      </div>
    </div>
  );
}
