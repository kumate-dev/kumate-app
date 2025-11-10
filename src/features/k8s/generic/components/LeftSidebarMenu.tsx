import React, { useMemo, useCallback } from 'react';
import { PageKey } from '@/types/pageKey';
import { K8sContext } from '@/api/k8s/contexts';

// Generate a pleasant, consistent HSL color from a string (cluster name)
const stringToHslColor = (str: string, s = 60, l = 50): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

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

export interface SidebarMenuProps {
  contexts?: K8sContext[];
  selected?: K8sContext;
  onSelectContext?: (ctx?: K8sContext) => void;
  page?: PageKey;
  onSelectPage?: (page: PageKey) => void;
}

const CATEGORY_GROUPS: PageItem[] = [
  {
    title: 'Overview',
    navigateKey: 'overview' as PageKey,
    collapsible: false,
  },
  {
    title: 'Nodes',
    navigateKey: 'nodes' as PageKey,
    collapsible: false,
  },
  {
    title: 'Namespaces',
    navigateKey: 'namespaces' as PageKey,
    collapsible: false,
  },
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
  {
    title: 'Helm',
    items: [{ key: 'helm_releases', label: 'Releases' }],
    collapsible: true,
  },
  {
    title: 'Custom Resources',
    items: [{ key: 'custom_resource_definitions', label: 'Definitions' }],
    collapsible: true,
  },
  {
    title: 'Events',
    navigateKey: 'events' as PageKey,
    collapsible: false,
  },
];

export const LeftSidebarMenu: React.FC<SidebarMenuProps> = ({
  contexts = [],
  selected,
  onSelectContext,
  page,
  onSelectPage,
}) => {
  const [connMap, setConnMap] = React.useState<Record<string, boolean>>({});
  const [menu, setMenu] = React.useState<
    { open: true; x: number; y: number; name: string } | { open: false }
  >({ open: false });
  // Expand/Collapse hotbar: when expanded, show cluster name next to avatar
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};

    CATEGORY_GROUPS.forEach((group) => {
      if (group.collapsible && group.title) {
        initialState[group.title] = true;
      }
    });

    contexts.forEach((context) => {
      CATEGORY_GROUPS.forEach((group) => {
        if (group.collapsible && group.title) {
          initialState[`${context.name}:${group.title}`] = true;
        }
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

    return CATEGORY_GROUPS.map((category) => ({
      ...category,
      items:
        category.items?.map((item) => ({
          ...item,
          clusterName: selected.name,
        })) || [],
    }));
  }, [selected]);

  const hotbarClusters = useMemo(
    () => contexts.map((context) => ({ name: context.name })),
    [contexts]
  );

  React.useEffect(() => {
    // Fetch current connection statuses; default to connected when not present
    import('@/api/k8s/contexts').then(({ getContextConnections }) => {
      getContextConnections()
        .then((items) => {
          const m: Record<string, boolean> = {};
          for (const it of items) m[it.name] = it.connected;
          setConnMap(m);
        })
        .catch(() => {
          // ignore errors, keep defaults
        });
    });
  }, []);

  const handleClusterSelect = useCallback(
    (clusterName: string) => {
      const context = contexts.find((ctx) => ctx.name === clusterName);
      onSelectContext?.(context);
      // Fire a background warmup when switching cluster selection
      if (clusterName) {
        import('@/api/k8s/warmup')
          .then(({ warmupContext }) => warmupContext(clusterName))
          .catch(() => {});
      }
      onSelectPage?.('overview');
    },
    [contexts, onSelectContext, onSelectPage]
  );

  const handleClusterContextMenu = useCallback((e: React.MouseEvent, clusterName: string) => {
    e.preventDefault();
    setMenu({ open: true as const, x: e.clientX, y: e.clientY, name: clusterName });
  }, []);

  const closeMenu = useCallback(() => setMenu({ open: false }), []);

  const setConnected = useCallback(async (name: string, connected: boolean) => {
    try {
      const { setContextConnection } = await import('@/api/k8s/contexts');
      await setContextConnection(name, connected);
      setConnMap((prev) => ({ ...prev, [name]: connected }));

      // Proactively warm up the context after successful connection to reduce initial load time
      if (connected) {
        // Fire and forget; we don't block the UI on warmup
        import('@/api/k8s/warmup').then(({ warmupContext }) => warmupContext(name)).catch(() => {});
      }
    } catch {}
  }, []);

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
      const isCollapsible = group.collapsible ?? false;
      const isCollapsed = group.title ? collapsed[group.title] : false;
      const isNavigable = !!group.navigateKey && !isCollapsible;
      const isActive = isNavigable && page === group.navigateKey;

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
              className={`mb-2 flex w-full items-center justify-between text-left text-xs tracking-wide uppercase transition-colors ${
                isActive ? 'text-white' : 'text-white/50 hover:text-white'
              }`}
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
    [collapsed, toggleGroup, handlePageSelect, renderGroupItem, page]
  );

  return (
    <aside className={`flex w-64 border-r border-white/10 bg-neutral-950 text-white`}>
      <div className="flex w-10 flex-col items-center gap-2 border-r border-white/10 bg-neutral-900/30 py-2">
        {hotbarClusters.map((cluster) => {
          const initial = (cluster.name?.[0] || '?').toUpperCase();
          const connected = connMap[cluster.name] ?? true;

          return (
            <button
              key={cluster.name}
              className="m-0 flex h-10 w-10 items-center justify-center border-none bg-transparent p-0 hover:bg-transparent focus:ring-0 focus:outline-none"
              onClick={() => handleClusterSelect(cluster.name)}
              onContextMenu={(e) => handleClusterContextMenu(e, cluster.name)}
              aria-label={cluster.name}
              title={cluster.name}
            >
              <span
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${connected ? '' : 'opacity-50'}`}
                style={{ background: stringToHslColor(cluster.name, 65, 45) }}
              >
                {initial}
                <span
                  className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
                  style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }}
                />
              </span>
            </button>
          );
        })}
        <div className="mt-auto flex items-center justify-center px-0">
          <button
            className="flex h-8 w-full items-center justify-center bg-transparent text-xs text-white/60 hover:text-white"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>›</span>
          </button>
        </div>
        {menu.open && (
          <div
            className="fixed z-50 min-w-40 rounded border border-white/10 bg-neutral-900 p-1 text-sm shadow-lg"
            style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
            onMouseLeave={closeMenu}
          >
            {(() => {
              const connected = connMap[menu.name] ?? true;
              return (
                <ul>
                  {!connected && (
                    <li>
                      <button
                        className="w-full rounded px-3 py-2 text-left hover:bg-white/10"
                        onClick={async () => {
                          await setConnected(menu.name, true);
                          closeMenu();
                        }}
                      >
                        Connect
                      </button>
                    </li>
                  )}
                  {connected && (
                    <>
                      <li>
                        <button
                          className="w-full rounded px-3 py-2 text-left hover:bg-white/10"
                          onClick={async () => {
                            // Reconnect: briefly disconnect then connect
                            await setConnected(menu.name, false);
                            await setConnected(menu.name, true);
                            closeMenu();
                          }}
                        >
                          Reconnect
                        </button>
                      </li>
                      <li>
                        <button
                          className="w-full rounded px-3 py-2 text-left text-red-300 hover:bg-white/10"
                          onClick={async () => {
                            await setConnected(menu.name, false);
                            closeMenu();
                          }}
                        >
                          Disconnect
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-auto">{groups.map(renderGroup)}</div>
    </aside>
  );
};
