import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export const Tabs = TabsPrimitive.Root;

interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  className?: string;
}
export const TabsList: React.FC<TabsListProps> = ({ className = '', ...props }) => (
  <TabsPrimitive.List
    className={`flex items-center gap-1 rounded-md border border-white/10 bg-neutral-900/60 p-1 ${className}`}
    {...props}
  />
);

interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  className?: string;
}
export const TabsTrigger: React.FC<TabsTriggerProps> = ({ className = '', ...props }) => (
  <TabsPrimitive.Trigger
    className={`inline-flex h-8 items-center justify-center rounded px-3 text-sm text-white/80 hover:bg-white/10 data-[state=active]:bg-white/10 data-[state=active]:text-white ${className}`}
    {...props}
  />
);

interface TabsContentProps extends React.ComponentProps<typeof TabsPrimitive.Content> {
  className?: string;
}
export const TabsContent: React.FC<TabsContentProps> = ({ className = '', ...props }) => (
  <TabsPrimitive.Content className={`mt-3 ${className}`} {...props} />
);
