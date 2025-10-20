import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui";
import { Activity, Server, Boxes, Network } from "lucide-react";
import Overview from "./Overview";
import WorkloadsPane from "./PanePods";
import PaneNodes from "./PaneNodes";

function Placeholder({ title }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="text-white/80">{title}</div>
      <div className="text-white/60 text-sm mt-2">Chưa có dữ liệu. Sẽ cập nhật sau.</div>
    </div>
  );
}

export default function PaneOverview({ context, onShowSecrets, onDelete }) {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold">{context?.name || "No selection"}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-2">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full justify-start gap-1 rounded-lg">
            <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="nodes" className="gap-2"><Server className="h-4 w-4" /> Nodes</TabsTrigger>
            <TabsTrigger value="pods" className="gap-2"><Boxes className="h-4 w-4" /> Pods</TabsTrigger>
            <TabsTrigger value="services" className="gap-2"><Network className="h-4 w-4" /> Services</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-2">
            <Overview selected={context} onShowSecrets={onShowSecrets} onDelete={onDelete} />
          </TabsContent>
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