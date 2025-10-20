import { Button } from "../components/ui";

export function Topbar({ selected, onRefresh, refreshing }) {
  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 bg-neutral-900/60 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/40">
      <div className="flex items-center gap-2">
        <div className="text-xs text-white/60">Cluster</div>
        <div className="font-medium">{selected?.name || "Select a context"}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}