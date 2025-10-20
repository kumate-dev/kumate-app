import React from "react";
import { Tabs, TabsList, TabsTrigger } from "../components/ui";
import { IconOverview } from "../components/custom/IconOverview";
import { IconSecrets } from "../components/custom/IconSecrets";
import { IconWorkloads } from "../components/custom/IconWorkloads";
import { IconConfig } from "../components/custom/IconConfig";
import { IconNetwork } from "../components/custom/IconNetwork";

interface Tab {
  key: string;
  label: string;
  icon: React.ComponentType;
}

interface TabBarProps {
  active: string;
  onChange: (value: string) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  const tabs: Tab[] = [
    { key: "overview", label: "Overview", icon: IconOverview },
    { key: "secrets", label: "Secrets", icon: IconSecrets },
    { key: "workloads", label: "Workloads", icon: IconWorkloads },
    { key: "config", label: "Config", icon: IconConfig },
    { key: "network", label: "Network", icon: IconNetwork },
  ];

  return (
    <div className="border-b border-white/10 px-4 bg-neutral-900/80">
      <Tabs value={active} onValueChange={onChange}>
        <TabsList className="rounded-lg">
          {tabs.map((t) => {
            const IconComp = t.icon;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="flex items-center gap-2"
              >
                <IconComp /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
