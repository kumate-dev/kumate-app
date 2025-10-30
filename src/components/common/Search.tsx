import { Input } from '@/components/ui/input';

interface SearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  className?: string;
}

export function Search({ query, onQueryChange, className = 'max-w-xs' }: SearchProps) {
  return (
    <Input
      placeholder="Search..."
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      className={className}
    />
  );
}
