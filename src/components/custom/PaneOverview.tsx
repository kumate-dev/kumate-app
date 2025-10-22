import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Server, Boxes, Network } from 'lucide-react';
import WorkloadsPane from '@/components/custom/PanePods';
import PaneNodes from '@/components/custom/PaneNodes';
import { K8sContext } from '@/services/contexts';

interface PlaceholderProps {
  title: string;
}

function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="text-white/80">{title}</div>
      <div className="mt-2 text-sm text-white/60">Coming soon...</div>
    </div>
  );
}

interface PaneOverviewProps {
  context?: K8sContext | null;
}

export default function PaneOverview({ context }: PaneOverviewProps) {
  const [tab, setTab] = useState<string>('overview');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold">{context?.name || 'No selection'}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-2">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full justify-start gap-1 rounded-lg">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="nodes" className="gap-2">
              <Server className="h-4 w-4" /> Nodes
            </TabsTrigger>
            <TabsTrigger value="pods" className="gap-2">
              <Boxes className="h-4 w-4" /> Pods
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Network className="h-4 w-4" /> Services
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nodes" className="mt-2">
            <PaneNodes context={context} />
          </TabsContent>
          <TabsContent value="pods" className="mt-2">
            <WorkloadsPane context={context} />
          </TabsContent>
          <TabsContent value="services" className="mt-2">
            <Placeholder title="Services" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
