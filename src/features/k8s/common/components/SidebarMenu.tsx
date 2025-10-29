import React from 'react';
import { PageKey } from '@/types/pageKey';
import { K8sContext } from '@/api/k8s/contexts';

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

export interface SidebarMenuProps {
  contexts?: K8sContext[];
  selected?: K8sContext;
  onSelectContext?: (ctx?: K8sContext) => void;
  page?: PageKey;
  onSelectPage?: (page: PageKey) => void;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
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
      items: [
        { key: 'workloads_overview', label: 'Overview' },
        { key: 'pods', label: 'Pods' },
        { key: 'deployments', label: 'Deployments' },
        { key: 'replica_sets', label: 'Replica Sets' },
        { key: 'daemon_sets', label: 'Daemon Sets' },
        { key: 'stateful_sets', label: 'Stateful Sets' },
        { key: 'replication_controllers', label: 'Replication Controllers' },
        { key: 'jobs', label: 'Jobs' },
        { key: 'cron_jobs', label: 'Cron Jobs' },
      ],
    },
    {
      title: 'Config',
      items: [
        { key: 'config_maps', label: 'Config Maps' },
        { key: 'secrets', label: 'Secrets' },
        { key: 'resource_quotas', label: 'Resource Quotas' },
        { key: 'limit_ranges', label: 'Limit Ranges' },
        { key: 'horizontal_pod_autoscalers', label: 'Horizontal Pod Autoscalers' },
        { key: 'pod_disruption_budgets', label: 'Pod Disruption Budgets' },
        { key: 'priority_classes', label: 'Priority Classes' },
        { key: 'runtime_classes', label: 'Runtime Classes' },
        { key: 'leases', label: 'Leases' },
        { key: 'mutating_webhooks', label: 'Mutating Webhook Configurations' },
        { key: 'validating_webhooks', label: 'Validating Webhook Configurations' },
      ],
    },
    {
      title: 'Network',
      items: [
        { key: 'services', label: 'Services' },
        { key: 'endpoints', label: 'Endpoints' },
        { key: 'ingresses', label: 'Ingresses' },
        { key: 'ingress_classes', label: 'Ingress Classes' },
        { key: 'network_policies', label: 'Network Policies' },
        { key: 'port_forwarding', label: 'Port Forwarding' },
      ],
    },
    {
      title: 'Storage',
      items: [
        { key: 'persistent_volume_claims', label: 'Persistent Volume Claims' },
        { key: 'persistent_volumes', label: 'Persistent Volumes' },
        { key: 'storage_classes', label: 'Storage Classes' },
      ],
    },
    {
      title: 'Helm',
      items: [
        { key: 'helm_charts', label: 'Charts' },
        { key: 'helm_releases', label: 'Releases' },
      ],
    },
    {
      title: 'Access Control',
      items: [
        { key: 'service_accounts', label: 'Service Accounts' },
        { key: 'cluster_roles', label: 'Cluster Roles' },
        { key: 'roles', label: 'Roles' },
        { key: 'cluster_role_bindings', label: 'Cluster Role Bindings' },
        { key: 'role_bindings', label: 'Role Bindings' },
      ],
    },
  ];

  const groups: PageItem[] = selected
    ? [
        { title: 'Overview', items: [], navigateKey: 'overview' },
        { title: 'Nodes', items: [], navigateKey: 'nodes' },
        { title: 'Namespaces', items: [], navigateKey: 'namespaces' },
        ...categoryGroups.map((cat) => ({
          title: cat.title,
          items: cat.items?.map((it) => ({ ...it, clusterName: selected.name })) || [],
        })),
        { title: 'Events', items: [], navigateKey: 'events' },
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
