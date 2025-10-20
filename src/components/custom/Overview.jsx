import React from "react";
import { Button } from "../ui";
import { IconNetwork } from "./IconNetwork";
import { IconWorkloads } from "./IconWorkloads";
import { IconConfig } from "./IconConfig";

export default function Overview({ selected, onShowSecrets, onDelete }) {
  if (!selected) {
    return <div className="p-6 text-white/70">Select a context on the left.</div>;
  }

  const cards = [
    { label: "Cluster", value: selected.cluster || "-", icon: IconNetwork },
    { label: "User", value: selected.user || "-", icon: IconWorkloads },
    { label: "Namespace", value: selected.namespace || "-", icon: IconConfig },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const IconComp = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center rounded bg-white/10 p-2">
                  <IconComp />
                </span>
                <div>
                  <div className="text-sm text-white/60">{c.label}</div>
                  <div className="text-2xl font-semibold">{c.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onShowSecrets(selected.name)}>
          Show Secrets
        </Button>
        <Button variant="outline" className="text-red-400" onClick={() => onDelete(selected.name)}>
          Delete Context
        </Button>
      </div>
    </div>
  );
}