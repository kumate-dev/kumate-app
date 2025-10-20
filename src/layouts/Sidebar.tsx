import React from 'react';
import { IconWorkloads } from '../components/custom/IconWorkloads';
import { IconConfig } from '../components/custom/IconConfig';
import { IconNetwork } from '../components/custom/IconNetwork';
import { IconStorage } from '../components/custom/IconStorage';
import { IconNamespaces } from '../components/custom/IconNamespaces';
import { IconEvents } from '../components/custom/IconEvents';
import { IconHelm } from '../components/custom/IconHelm';
import { IconAccessControl } from '../components/custom/IconAccessControl';
import { IconNode } from '../components/custom/IconNode';
import { IconOverview } from '../components/custom/IconOverview';
import { PageKey } from '../types/pageKey';

export interface K8sContext {
  name: string;
  [key: string]: any;
}

export interface PageItem {
  key?: PageKey;
  label?: string;
  clusterName?: string;
  type?: 'group' | 'clusterItem' | 'context';
  items?: PageItem[];
  icon?: React.ElementType;
  navigateKey?: PageKey;
  title?: string;
}

export interface SidebarProps {
  contexts?: K8sContext[];
  selected?: K8sContext;
  onSelectContext?: (ctx?: K8sContext) => void;
  page?: PageKey;
  onSelectPage?: (page: PageKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  contexts = [],
  selected,
  onSelectContext,
  page,
  onSelectPage,
}) => {
  const collapsibleTitles = new Set([
    'Workloads',
    'Config',
    'Network',
    'Storage',
    'Helm',
    'Access Control',
  ]);

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    collapsibleTitles.forEach((t) => (s[t] = true));
    contexts.forEach((c) => {
      collapsibleTitles.forEach((t) => (s[`${c.name}:${t}`] = true));
      s[`cluster:${c.name}`] = true;
    });
    return s;
  });

  const collapseKey = (title: string, parent?: string) => (parent ? `${parent}:${title}` : title);
  const toggleGroup = (title: string, parent?: string) =>
    setCollapsed((s) => ({ ...s, [collapseKey(title, parent)]: !s[collapseKey(title, parent)] }));

  const categoryGroups: PageItem[] = [
    {
      title: 'Workloads',
      icon: IconWorkloads,
      items: [
        { key: 'workloads-overview', label: 'Overview' },
        { key: 'pods', label: 'Pods' },
        { key: 'deployments', label: 'Deployments' },
        { key: 'daemonsets', label: 'Daemon Sets' },
        { key: 'statefulsets', label: 'Stateful Sets' },
        { key: 'replicasets', label: 'Replica Sets' },
        { key: 'replicationcontrollers', label: 'Replication Controllers' },
        { key: 'jobs', label: 'Jobs' },
        { key: 'cronjobs', label: 'Cron Jobs' },
      ],
    },
    {
      title: 'Config',
      icon: IconConfig,
      items: [
        { key: 'configmaps', label: 'Config Maps' },
        { key: 'secrets', label: 'Secrets' },
        { key: 'resourcequotas', label: 'Resource Quotas' },
        { key: 'limitranges', label: 'Limit Ranges' },
        { key: 'hpas', label: 'Horizontal Pod Autoscalers' },
        { key: 'pdbs', label: 'Pod Disruption Budgets' },
        { key: 'priorityclasses', label: 'Priority Classes' },
        { key: 'runtimeclasses', label: 'Runtime Classes' },
        { key: 'leases', label: 'Leases' },
        { key: 'mutatingwebhooks', label: 'Mutating Webhook Configurations' },
        { key: 'validatingwebhooks', label: 'Validating Webhook Configurations' },
      ],
    },
    {
      title: 'Network',
      icon: IconNetwork,
      items: [
        { key: 'services', label: 'Services' },
        { key: 'endpoints', label: 'Endpoints' },
        { key: 'ingresses', label: 'Ingresses' },
        { key: 'ingressclasses', label: 'Ingress Classes' },
        { key: 'networkpolicies', label: 'Network Policies' },
        { key: 'portforwarding', label: 'Port Forwarding' },
      ],
    },
    {
      title: 'Storage',
      icon: IconStorage,
      items: [
        { key: 'persistentvolumeclaims', label: 'Persistent Volume Claims' },
        { key: 'persistentvolumes', label: 'Persistent Volumes' },
        { key: 'storageclasses', label: 'Storage Classes' },
      ],
    },
    {
      title: 'Helm',
      icon: IconHelm,
      items: [
        { key: 'helm-charts', label: 'Charts' },
        { key: 'helm-releases', label: 'Releases' },
      ],
    },
    {
      title: 'Access Control',
      icon: IconAccessControl,
      items: [
        { key: 'serviceaccounts', label: 'Service Accounts' },
        { key: 'clusterroles', label: 'Cluster Roles' },
        { key: 'roles', label: 'Roles' },
        { key: 'clusterrolebindings', label: 'Cluster Role Bindings' },
        { key: 'rolebindings', label: 'Role Bindings' },
      ],
    },
  ];

  const groups: PageItem[] = selected
    ? [
        { title: 'Overview', icon: IconOverview, items: [], navigateKey: 'overview' },
        { title: 'Nodes', icon: IconNode, items: [], navigateKey: 'nodes' },
        { title: 'Namespaces', icon: IconNamespaces, items: [], navigateKey: 'namespaces' },
        ...categoryGroups.map((cat) => ({
          title: cat.title,
          icon: cat.icon,
          items: cat.items?.map((it) => ({ ...it, clusterName: selected.name })) || [],
        })),
        { title: 'Events', icon: IconEvents, items: [], navigateKey: 'events' },
      ]
    : [];

  const hotbarClusters = contexts.map((c) => ({ name: c.name }));

  return (
    <aside className="flex w-64 border-r border-white/10 bg-neutral-950 text-white">
      <div className="flex w-10 flex-col items-center gap-2 border-r border-white/10 bg-neutral-900/30 py-2">
        {hotbarClusters.map((h) => {
          const active = selected?.name === h.name;
          const initial = (h.name?.[0] || '?').toUpperCase();
          return (
            <button
              key={h.name}
              className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${
                active ? 'bg-white/10' : ''
              }`}
              onClick={() => {
                const ctx = contexts.find((c) => c.name === h.name);
                onSelectContext?.(ctx);
                onSelectPage?.('overview');
              }}
              aria-label={h.name}
              title={h.name}
            >
              <span className="text-xs font-semibold">{initial}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-auto">
        {groups.map((g, idx) => {
          const GroupIcon = g.icon;

          return (
            <div key={(g.title || 'top') + idx} className="px-3 py-3">
              {g.title && (
                <button
                  className="mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide text-white/50 uppercase"
                  onClick={() => {
                    if (g.title && collapsibleTitles.has(g.title)) toggleGroup(g.title);
                    else if (g.navigateKey) onSelectPage?.(g.navigateKey);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {GroupIcon && (
                      <span className="inline-flex items-center justify-center rounded bg-white/5 p-1">
                        <GroupIcon />
                      </span>
                    )}
                    <span>{g.title}</span>
                  </span>
                  {collapsibleTitles.has(g.title) && (
                    <span
                      className={`inline-block transition-transform ${
                        collapsed[g.title] ? 'rotate-0' : 'rotate-90'
                      }`}
                    >
                      ›
                    </span>
                  )}
                </button>
              )}

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  !g.title
                    ? 'max-h-[800px] opacity-100'
                    : !collapsibleTitles.has(g.title) || !collapsed[g.title]
                      ? 'max-h-[800px] opacity-100'
                      : 'max-h-0 opacity-0'
                }`}
              >
                <ul>
                  {g.items?.map((it) => {
                    if (it.type === 'group') {
                      const isCollapsed = collapsed[`${g.title}:${it.title}`];
                      const SubIcon = it.icon;
                      return (
                        <div key={`${g.title}-${it.title}`} className="mb-2">
                          <button
                            className="mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide text-white/50 uppercase"
                            onClick={() => toggleGroup(it.title!, g.title)}
                          >
                            <span className="flex items-center gap-2">
                              {SubIcon && (
                                <span className="inline-flex items-center justify-center rounded bg-white/5 p-1">
                                  <SubIcon />
                                </span>
                              )}
                              <span>{it.title}</span>
                            </span>
                            <span
                              className={`inline-block transition-transform ${
                                isCollapsed ? 'rotate-0' : 'rotate-90'
                              }`}
                            >
                              ›
                            </span>
                          </button>
                          <div
                            className={`overflow-hidden transition-all duration-200 ${
                              !isCollapsed ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                            }`}
                          >
                            <ul>
                              {it.items?.map((child) => {
                                const active =
                                  selected?.name === child.clusterName && page === child.key;
                                return (
                                  <li key={`${child.clusterName}:${child.key}`}>
                                    <button
                                      className={`w-full rounded px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                                        active ? 'bg-white/10' : ''
                                      }`}
                                      onClick={() => {
                                        const ctx = contexts.find(
                                          (c) => c.name === child.clusterName
                                        );
                                        onSelectContext?.(ctx);
                                        onSelectPage?.(child.key!);
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">{child.label}</span>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      );
                    }

                    const active = page === it.key;
                    return (
                      <li key={it.key}>
                        <button
                          className={`w-full rounded px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                            active ? 'bg-white/10' : ''
                          }`}
                          onClick={() => onSelectPage?.(it.key!)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{it.label}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
