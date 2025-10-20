import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className = "", ...props }) => (
  <TabsPrimitive.List
    className={`flex items-center gap-1 rounded-md border border-white/10 bg-neutral-900/60 p-1 ${className}`}
    {...props}
  />
);
export const TabsTrigger = ({ className = "", ...props }) => (
  <TabsPrimitive.Trigger
    className={`inline-flex h-8 items-center justify-center rounded px-3 text-sm text-white/80 data-[state=active]:bg-white/10 data-[state=active]:text-white hover:bg-white/10 ${className}`}
    {...props}
  />
);
export const TabsContent = ({ className = "", ...props }) => (
  <TabsPrimitive.Content className={`mt-3 ${className}`} {...props} />
);