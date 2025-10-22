import { Input } from '@/components/ui/input';

interface PaneSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  className?: string;
}

export function PaneSearch({ query, onQueryChange, className = 'max-w-xs' }: PaneSearchProps) {
  return (
    <Input
      placeholder="Search..."
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      className={className}
    />
  );
}
