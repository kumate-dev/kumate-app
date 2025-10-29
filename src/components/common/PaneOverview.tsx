import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity } from 'lucide-react';
import { K8sContext } from '@/api/k8s/contexts';

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
          </TabsList>
          <TabsContent value="services" className="mt-2">
            <Placeholder title="Services" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
