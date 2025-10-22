import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconOverview } from '@/components/custom/IconOverview';

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
  const tabs: Tab[] = [{ key: 'overview', label: 'Overview', icon: IconOverview }];

  return (
    <div className="border-b border-white/10 bg-neutral-900/80 px-4">
      <Tabs value={active} onValueChange={onChange}>
        <TabsList className="rounded-lg">
          {tabs.map((t) => {
            const IconComp = t.icon;
            return (
              <TabsTrigger key={t.key} value={t.key} className="flex items-center gap-2">
                <IconComp /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
