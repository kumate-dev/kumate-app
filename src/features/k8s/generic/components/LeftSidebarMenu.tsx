import React, { useMemo, useCallback } from 'react';
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

const COLLAPSIBLE_TITLES = new Set([
  'Workloads',
  'Config',
  'Network',
  'Storage',
  'Helm',
  'Access Control',
  'Custom Resources',
]);

const CATEGORY_GROUPS: PageItem[] = [
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
      { key: 'mutating_webhooks', label: 'Mutating Webhook' },
      { key: 'validating_webhooks', label: 'Validating Webhook' },
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
    title: 'Access Control',
    items: [
      { key: 'service_accounts', label: 'Service Accounts' },
      { key: 'cluster_roles', label: 'Cluster Roles' },
      { key: 'roles', label: 'Roles' },
      { key: 'cluster_role_bindings', label: 'Cluster Role Bindings' },
      { key: 'role_bindings', label: 'Role Bindings' },
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
    title: 'Custom Resources',
    items: [{ key: 'custom_resource_definitions', label: 'Definitions' }],
  },
];

export const LeftSidebarMenu: React.FC<SidebarMenuProps> = ({
  contexts = [],
  selected,
  onSelectContext,
  page,
  onSelectPage,
}) => {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};

    COLLAPSIBLE_TITLES.forEach((title) => {
      initialState[title] = true;
    });

    contexts.forEach((context) => {
      COLLAPSIBLE_TITLES.forEach((title) => {
        initialState[`${context.name}:${title}`] = true;
      });
      initialState[`cluster:${context.name}`] = true;
    });

    return initialState;
  });

  const collapseKey = useCallback(
    (title: string, parent?: string) => (parent ? `${parent}:${title}` : title),
    []
  );

  const toggleGroup = useCallback(
    (title: string, parent?: string) => {
      const key = collapseKey(title, parent);
      setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [collapseKey]
  );

  const groups = useMemo(() => {
    if (!selected) return [];

    return [
      { title: 'Overview', items: [], navigateKey: 'overview' as PageKey },
      { title: 'Nodes', items: [], navigateKey: 'nodes' as PageKey },
      { title: 'Namespaces', items: [], navigateKey: 'namespaces' as PageKey },
      ...CATEGORY_GROUPS.map((category) => ({
        title: category.title,
        items:
          category.items?.map((item) => ({
            ...item,
            clusterName: selected.name,
          })) || [],
      })),
      { title: 'Events', items: [], navigateKey: 'events' as PageKey },
    ];
  }, [selected]);

  const hotbarClusters = useMemo(
    () => contexts.map((context) => ({ name: context.name })),
    [contexts]
  );

  const handleClusterSelect = useCallback(
    (clusterName: string) => {
      const context = contexts.find((ctx) => ctx.name === clusterName);
      onSelectContext?.(context);
      onSelectPage?.('overview');
    },
    [contexts, onSelectContext, onSelectPage]
  );

  const handlePageSelect = useCallback(
    (pageKey: PageKey) => {
      onSelectPage?.(pageKey);
    },
    [onSelectPage]
  );

  const renderGroupItem = useCallback(
    (item: PageItem, parentTitle?: string) => {
      if (item.type === 'group') {
        const isCollapsed = collapsed[`${parentTitle}:${item.title}`];
        const SubIcon = item.icon;

        return (
          <div key={`${parentTitle}-${item.title}`} className="mb-2">
            <button
              className="mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide text-white/50 uppercase"
              onClick={() => toggleGroup(item.title!, parentTitle)}
            >
              <span className="flex items-center gap-2">
                {SubIcon && (
                  <span className="inline-flex items-center justify-center rounded bg-white/5 p-1">
                    <SubIcon />
                  </span>
                )}
                <span>{item.title}</span>
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
              <ul>{item.items?.map((child) => renderGroupItem(child, item.title))}</ul>
            </div>
          </div>
        );
      }

      const active = page === item.key;
      return (
        <li key={item.key}>
          <button
            className={`w-full rounded px-3 py-2 text-left transition-colors hover:bg-white/5 ${
              active ? 'bg-white/10' : ''
            }`}
            onClick={() => handlePageSelect(item.key!)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.label}</span>
            </div>
          </button>
        </li>
      );
    },
    [collapsed, page, toggleGroup, handlePageSelect]
  );

  const renderGroup = useCallback(
    (group: PageItem, index: number) => {
      const GroupIcon = group.icon;
      const isCollapsible = group.title && COLLAPSIBLE_TITLES.has(group.title);
      const isCollapsed = group.title ? collapsed[group.title] : false;

      const handleGroupClick = () => {
        if (isCollapsible && group.title) {
          toggleGroup(group.title);
        } else if (group.navigateKey) {
          handlePageSelect(group.navigateKey);
        }
      };

      return (
        <div key={group.title || `top-${index}`} className="px-3 py-3">
          {group.title && (
            <button
              className="mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide text-white/50 uppercase"
              onClick={handleGroupClick}
            >
              <span className="flex items-center gap-2">
                {GroupIcon && (
                  <span className="inline-flex items-center justify-center rounded bg-white/5 p-1">
                    <GroupIcon />
                  </span>
                )}
                <span>{group.title}</span>
              </span>
              {isCollapsible && (
                <span
                  className={`inline-block transition-transform ${
                    isCollapsed ? 'rotate-0' : 'rotate-90'
                  }`}
                >
                  ›
                </span>
              )}
            </button>
          )}

          <div
            className={`overflow-hidden transition-all duration-200 ${
              !group.title || !isCollapsible || !isCollapsed
                ? 'max-h-[800px] opacity-100'
                : 'max-h-0 opacity-0'
            }`}
          >
            <ul>{group.items?.map((item) => renderGroupItem(item, group.title))}</ul>
          </div>
        </div>
      );
    },
    [collapsed, toggleGroup, handlePageSelect, renderGroupItem]
  );

  return (
    <aside className="flex w-64 border-r border-white/10 bg-neutral-950 text-white">
      <div className="flex w-10 flex-col items-center gap-2 border-r border-white/10 bg-neutral-900/30 py-2">
        {hotbarClusters.map((cluster) => {
          const active = selected?.name === cluster.name;
          const initial = (cluster.name?.[0] || '?').toUpperCase();

          return (
            <button
              key={cluster.name}
              className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${
                active ? 'bg-white/10' : ''
              }`}
              onClick={() => handleClusterSelect(cluster.name)}
              aria-label={cluster.name}
              title={cluster.name}
            >
              <span className="text-xs font-semibold">{initial}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-auto">{groups.map(renderGroup)}</div>
    </aside>
  );
};
