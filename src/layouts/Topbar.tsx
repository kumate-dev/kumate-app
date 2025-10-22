import { Button } from '@/components/ui/button';

interface Cluster {
  name: string;
}

interface TopbarProps {
  selected?: Cluster | null;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function Topbar({ selected, onRefresh, refreshing = false }: TopbarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-white/10 bg-neutral-900/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/40">
      <div className="flex items-center gap-2">
        <div className="text-xs text-white/60">Cluster</div>
        <div className="font-medium">{selected?.name || 'Select a context'}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
