import { Input } from '@/components/ui/input';
import { useCallback } from 'react';

interface SearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  className?: string;
}

export function Search({ query, onQueryChange, className = 'max-w-xs' }: SearchProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(e.target.value);
    },
    [onQueryChange]
  );

  return (
    <Input placeholder="Search..." value={query} onChange={handleChange} className={className} />
  );
}
