import React from 'react';
import { ButtonSecondary } from '@/components/common/ButtonSecondary';

export interface SidebarHotbarProps {
  clusters: { name: string; displayName?: string; avatarSrc?: string }[];
  connMap: Record<string, boolean | null>;
  setConnected: (name: string, connected: boolean) => Promise<boolean>;
  expanded: boolean;
  onExpandChange?: (expanded: boolean) => void;
  onClusterClick?: (clusterName: string) => void;
  onEditCluster?: (clusterName: string) => void;
}

const stringToHslColor = (str: string, s = 60, l = 50): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const SidebarHotbar: React.FC<SidebarHotbarProps> = ({
  clusters,
  connMap,
  setConnected,
  expanded,
  onExpandChange,
  onClusterClick,
  onEditCluster,
}) => {
  const [loadingMap, setLoadingMap] = React.useState<Record<string, boolean>>({});
  const [menu, setMenu] = React.useState<
    { open: true; x: number; y: number; name: string } | { open: false }
  >({ open: false });
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const handleClusterContextMenu = React.useCallback((e: React.MouseEvent, clusterName: string) => {
    e.preventDefault();
    setMenu({ open: true as const, x: e.clientX, y: e.clientY, name: clusterName });
  }, []);

  const closeMenu = React.useCallback(() => setMenu({ open: false }), []);

  // Close context menu when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!menu.open) return;

    const handleMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menu.open, closeMenu]);

  const showConnectOverlay = React.useCallback(() => {
    if (typeof document === 'undefined') return () => {};
    const overlay = document.createElement('div');
    overlay.id = 'kumate-connect-overlay';
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/30';
    const spinner = document.createElement('span');
    spinner.className =
      'h-6 w-6 rounded-full border-4 border-white/40 border-t-transparent animate-spin';
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
    return () => {
      try {
        overlay.remove();
      } catch {}
    };
  }, []);

  return (
    <div
      className={`flex h-full flex-shrink-0 flex-col items-stretch gap-3 overflow-y-auto overscroll-none bg-neutral-900/30 py-3 transition-all ${expanded ? 'w-40 pr-3 pl-2' : 'w-12 pr-0 pl-0'} mr-2`}
    >
      {clusters.map((cluster) => {
        const initial = (cluster.displayName || cluster.name)?.[0]?.toUpperCase() || '?';
        const connected = cluster.name in connMap ? connMap[cluster.name] : null;
        const loading = !!loadingMap[cluster.name];

        return (
          <button
            key={cluster.name}
            className={`m-0 flex h-12 ${expanded ? 'w-full justify-start px-2' : 'w-full justify-center px-0'} items-center rounded border-none bg-transparent hover:bg-white/5 focus:ring-0 focus:outline-none`}
            // Keep responsive click behavior without disabling or showing loading cursor
            onClick={async () => {
              const status = cluster.name in connMap ? connMap[cluster.name] : null;
              if (!loading && status !== true) {
                setLoadingMap((prev) => ({ ...prev, [cluster.name]: true }));
                const hide = showConnectOverlay();
                const ok = await setConnected(cluster.name, true).finally(() => {
                  setLoadingMap((prev) => ({ ...prev, [cluster.name]: false }));
                  hide();
                });
                if (!ok) return;
              }
              onClusterClick?.(cluster.name);
            }}
            onContextMenu={(e) => handleClusterContextMenu(e, cluster.name)}
            aria-label={cluster.name}
            title={cluster.name}
          >
            <span
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${connected ? '' : 'opacity-50'}`}
              style={{
                background: cluster.avatarSrc
                  ? 'transparent'
                  : stringToHslColor(cluster.name, 65, 45),
              }}
            >
              {cluster.avatarSrc ? (
                <img
                  src={cluster.avatarSrc}
                  alt="avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                initial
              )}
              {(() => {
                const color =
                  connected === true ? '#22c55e' : connected === false ? '#ef4444' : '#9ca3af';
                return (
                  <span
                    className="absolute right-[2px] bottom-[2px] h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
                    style={{ backgroundColor: color }}
                  />
                );
              })()}
            </span>
            {expanded && (
              <span className="ml-2 truncate text-xs text-white/80">
                {cluster.displayName || cluster.name}
              </span>
            )}
          </button>
        );
      })}

      <div className="mt-auto flex items-center justify-center px-0">
        <ButtonSecondary
          className="group h-9 w-9 rounded-full border border-white/20 bg-white/5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => {
            const next = !expanded;
            onExpandChange?.(next);
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>›</span>
        </ButtonSecondary>
      </div>

      {menu.open && (
        <div
          className="fixed z-50 min-w-40 rounded border border-white/10 bg-neutral-900 p-1 text-sm shadow-lg"
          style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
          ref={menuRef}
          onMouseLeave={closeMenu}
        >
          {(() => {
            const connected = menu.name in connMap ? connMap[menu.name] : null;
            return (
              <ul>
                {/* Edit always first */}
                <li>
                  <button
                    className={`w-full rounded px-3 py-2 text-left hover:bg-white/10`}
                    onClick={() => {
                      onEditCluster?.(menu.name);
                      closeMenu();
                    }}
                  >
                    {'Edit'}
                  </button>
                </li>

                {/* Connection actions */}
                {!connected && (
                  <li>
                    <button
                      className={`w-full rounded px-3 py-2 text-left hover:bg-white/10`}
                      onClick={async () => {
                        const hide = showConnectOverlay();
                        try {
                          await setConnected(menu.name, true);
                        } finally {
                          hide();
                        }
                        closeMenu();
                      }}
                    >
                      {'Connect'}
                    </button>
                  </li>
                )}
                {connected && (
                  <>
                    <li>
                      <button
                        className={`w-full rounded px-3 py-2 text-left hover:bg-white/10`}
                        onClick={async () => {
                          const hide = showConnectOverlay();
                          try {
                            await setConnected(menu.name, false);
                            await setConnected(menu.name, true);
                          } finally {
                            hide();
                          }
                          closeMenu();
                        }}
                      >
                        {'Reconnect'}
                      </button>
                    </li>
                    <li>
                      <button
                        className={`w-full rounded px-3 py-2 text-left text-red-300 hover:bg-white/10`}
                        onClick={async () => {
                          await setConnected(menu.name, false);
                          closeMenu();
                        }}
                      >
                        {'Disconnect'}
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
  );
};
