import React from 'react';
import { stringToHslColor } from '@/utils/string';
import { startResizing } from '@/utils/resizing';
import { useDynamicHotbarMaxWidth } from '@/hooks/useDynamicHotbarMaxWidth';

const MIN_HOTBAR_WIDTH = 70;
const MAX_HOTBAR_WIDTH = 600;

export interface SidebarHotbarProps {
  clusters: { name: string; displayName?: string; avatarSrc?: string }[];
  connMap: Record<string, boolean | null>;
  setConnected: (name: string, connected: boolean) => Promise<boolean>;
  expanded: boolean;
  onExpandChange?: (expanded: boolean) => void;
  onClusterClick?: (clusterName: string) => void;
  onEditCluster?: (clusterName: string) => void;
}

export const SidebarHotbar: React.FC<SidebarHotbarProps> = ({
  clusters,
  connMap,
  setConnected,
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

  const [isResizing, setIsResizing] = React.useState(false);
  const dynamicMaxWidth = useDynamicHotbarMaxWidth(clusters, MIN_HOTBAR_WIDTH, MAX_HOTBAR_WIDTH);
  const [hotbarWidth, setHotbarWidth] = React.useState<number>(() => {
    try {
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem('kumate.hotbar.width') : null;
      const w = stored ? parseInt(stored, 10) : 200; // default expanded width aligns with right sidebar min
      const max = dynamicMaxWidth;
      const val = Number.isFinite(w) ? w : 200;
      return Math.min(Math.max(val, MIN_HOTBAR_WIDTH), max);
    } catch {
      return 200;
    }
  });

  // Clamp current width if dynamic max shrinks due to cluster changes
  React.useEffect(() => {
    setHotbarWidth((prev) => Math.min(prev, dynamicMaxWidth));
  }, [dynamicMaxWidth]);

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('kumate.hotbar.width', String(hotbarWidth));
      }
    } catch {}
  }, [hotbarWidth]);

  const onResize = React.useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => hotbarWidth,
          setSize: setHotbarWidth,
          minSize: MIN_HOTBAR_WIDTH, // minimum width
          maxSize: dynamicMaxWidth,
          axis: 'horizontal',
          invert: true, // right-edge handle: dragging to the right increases width
        },
        setIsResizing
      );
    },
    [hotbarWidth, dynamicMaxWidth]
  );

  return (
    <div
      className={`relative mr-2 flex h-full flex-shrink-0 flex-col items-stretch gap-3 overflow-y-auto overscroll-none bg-neutral-900/30 py-3 pr-3 pl-2 transition-all ${isResizing ? 'select-none' : ''}`}
      style={{ width: `${hotbarWidth}px` }}
    >
      <div
        className="absolute top-0 right-0 z-10 h-full w-3 cursor-ew-resize touch-none bg-transparent hover:bg-white/10 active:bg-white/20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResize(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          try {
            const tolerance = 2; // px tolerance when comparing with max
            const atMax = Math.abs(hotbarWidth - dynamicMaxWidth) <= tolerance;
            setHotbarWidth(atMax ? MIN_HOTBAR_WIDTH : dynamicMaxWidth);
          } finally {
            setIsResizing(false);
          }
        }}
      />
      {clusters.map((cluster) => {
        const initial = (cluster.displayName || cluster.name)?.[0]?.toUpperCase() || '?';
        const connected = cluster.name in connMap ? connMap[cluster.name] : null;
        const loading = !!loadingMap[cluster.name];

        return (
          <button
            key={cluster.name}
            className={`m-0 flex h-12 w-full items-center justify-start rounded border-none bg-transparent px-2 hover:bg-white/5 focus:ring-0 focus:outline-none`}
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
            <span className="ml-2 truncate text-xs text-white/80">
              {cluster.displayName || cluster.name}
            </span>
          </button>
        );
      })}

      {/* Hotbar is only controlled by drag-resize; expanded/collapsed sizing removed */}

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
