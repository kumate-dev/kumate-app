import React, { useMemo, useCallback } from 'react';
import { PageKey } from '@/types/pageKey';
import { K8sContext } from '@/api/k8s/contexts';

export interface SidebarCategoriesProps {
  selected?: K8sContext;
  page?: PageKey;
  onSelectPage?: (page: PageKey) => void;
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
  collapsible?: boolean;
}

const CATEGORY_GROUPS: PageItem[] = [
  { title: 'Overview', navigateKey: 'overview' as PageKey, collapsible: false },
  { title: 'Nodes', navigateKey: 'nodes' as PageKey, collapsible: false },
  { title: 'Namespaces', navigateKey: 'namespaces' as PageKey, collapsible: false },
  {
    title: 'Workloads',
    items: [
      { key: 'pods', label: 'Pods' },
      { key: 'deployments', label: 'Deployments' },
      { key: 'replica_sets', label: 'Replica Sets' },
      { key: 'daemon_sets', label: 'Daemon Sets' },
      { key: 'stateful_sets', label: 'Stateful Sets' },
      { key: 'replication_controllers', label: 'Replication Controllers' },
      { key: 'jobs', label: 'Jobs' },
      { key: 'cron_jobs', label: 'Cron Jobs' },
    ],
    collapsible: true,
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
    collapsible: true,
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
    collapsible: true,
  },
  {
    title: 'Storage',
    items: [
      { key: 'persistent_volume_claims', label: 'Persistent Volume Claims' },
      { key: 'persistent_volumes', label: 'Persistent Volumes' },
      { key: 'storage_classes', label: 'Storage Classes' },
    ],
    collapsible: true,
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
    collapsible: true,
  },
  { title: 'Helm', items: [{ key: 'helm_releases', label: 'Releases' }], collapsible: true },
  {
    title: 'Custom Resources',
    items: [{ key: 'custom_resource_definitions', label: 'Definitions' }],
    collapsible: true,
  },
  { title: 'Events', navigateKey: 'events' as PageKey, collapsible: false },
];

export const SidebarCategories: React.FC<SidebarCategoriesProps> = ({
  selected,
  page,
  onSelectPage,
}) => {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    CATEGORY_GROUPS.forEach((group) => {
      if (group.collapsible && group.title) initialState[group.title] = true;
    });
    return initialState;
  });

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const groups = useMemo(() => {
    if (!selected) return [];
    return CATEGORY_GROUPS.map((category) => ({
      ...category,
      items: category.items?.map((item) => ({ ...item, clusterName: selected.name })) || [],
    }));
  }, [selected]);

  const renderGroupItem = useCallback(
    (item: PageItem, parentTitle?: string) => {
      if (item.type === 'group') {
        const isCollapsed = collapsed[`${parentTitle}:${item.title}`];
        const SubIcon = item.icon;

        return (
          <div key={`${parentTitle}-${item.title}`} className="mb-2">
            <button
              className="mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide text-white/50 uppercase"
              onClick={() => toggleGroup(item.title!)}
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
                className={`inline-block transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
              >
                ›
              </span>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${!isCollapsed ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
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
            className={`w-full rounded px-3 py-2 text-left transition-colors hover:bg-white/5 ${active ? 'bg-white/10' : ''}`}
            onClick={() => onSelectPage?.(item.key!)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.label}</span>
            </div>
          </button>
        </li>
      );
    },
    [collapsed, page, toggleGroup, onSelectPage]
  );

  const renderGroup = useCallback(
    (group: PageItem, index: number) => {
      const GroupIcon = group.icon;
      const isCollapsible = group.collapsible ?? false;
      const isCollapsed = group.title ? collapsed[group.title] : false;
      const isNavigable = !!group.navigateKey && !isCollapsible;
      const isActive = isNavigable && page === group.navigateKey;

      const handleGroupClick = () => {
        if (isCollapsible && group.title) toggleGroup(group.title);
        else if (group.navigateKey) onSelectPage?.(group.navigateKey);
      };

      return (
        <div key={group.title || `top-${index}`} className="px-3 py-3">
          {group.title && (
            <button
              className={`mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide uppercase transition-colors ${isActive ? 'text-white' : 'text-white/50 hover:text-white'}`}
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
                  className={`inline-block transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
                >
                  ›
                </span>
              )}
            </button>
          )}

          <div
            className={`overflow-hidden transition-all duration-200 ${!group.title || !isCollapsible || !isCollapsed ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <ul>{group.items?.map((item) => renderGroupItem(item, group.title))}</ul>
          </div>
        </div>
      );
    },
    [collapsed, toggleGroup, renderGroupItem, page, onSelectPage]
  );

  return (
    <div className="flex w-[14rem] min-w-[14rem] flex-shrink-0 flex-col overflow-y-auto pr-2 pl-2">
      {groups.map(renderGroup)}
    </div>
  );
};