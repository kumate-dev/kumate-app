/**
 * The grouped resource navigation.
 *
 * Two things this file owns beyond its own markup:
 *
 * 1. **The canonical nav order** (`navGroups` / `navItems`). The command palette and the
 *    ⌘1..9 shortcuts must agree with what is on screen — "jump to the third item" is
 *    meaningless if three modules each compute their own ordering. `NAV_GROUPS` gives the
 *    group order, the registry gives the order within a group, and that is the only
 *    ordering in the app.
 *
 * 2. **Absence over dead links.** Only groups that contain at least one *registered*
 *    kind are rendered. A kind that has not been ported yet is simply not in the tree,
 *    rather than a menu entry that navigates to a not-found screen.
 *
 * Group collapse state and the sidebar width are persisted, because a developer tool
 * that forgets its layout every launch is a developer tool people stop resizing.
 * Resizing is pointer events on a 4px strip — the same 30 lines as `ui/Drawer.tsx`, and
 * for the same reason: a drag library is 20 KB to reimplement `setPointerCapture`.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { A } from '@solidjs/router';
import { ChevronRight } from 'lucide-solid';

import { NAV_GROUPS, type NavGroup, type ResourceDescriptor } from '@/features/resources/types';
import { populatedGroups, resourcesByGroup } from '@/features/resources/registry';
import type { K8sObject } from '@/lib/k8s';
import { cn } from '@/lib/k8s';

const WIDTH_KEY = 'kumate.nav.width';
const COLLAPSED_KEY = 'kumate.nav.collapsed';

const MIN_WIDTH = 168;
const MAX_WIDTH = 380;
const DEFAULT_WIDTH = 208;

export interface NavGroupModel {
  id: NavGroup;
  label: string;
  items: ResourceDescriptor<K8sObject>[];
}

/** Populated groups, in `NAV_GROUPS` order. */
export const navGroups = (): NavGroupModel[] => {
  const populated = new Set(populatedGroups());
  return NAV_GROUPS.filter((group) => populated.has(group.id)).map((group) => ({
    id: group.id,
    label: group.label,
    items: resourcesByGroup(group.id),
  }));
};

/** Every registered kind, flattened in the order it appears in the sidebar. */
export const navItems = (): ResourceDescriptor<K8sObject>[] =>
  navGroups().flatMap((group) => group.items);

/** Route for a kind. The single place the `/r/:id` shape is spelled out. */
export const resourceHref = (id: string): string => `/r/${id}`;

const readNumber = (key: string, fallback: number): number => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    // Storage can be unavailable; a default layout beats no sidebar.
    return fallback;
  }
};

const readCollapsed = (): Set<string> => {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
    }
  } catch {
    /* Corrupt value: start with everything expanded. */
  }
  return new Set();
};

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Persistence is a convenience, never a requirement. */
  }
};

export function NavSidebar(): JSX.Element {
  const clamp = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

  const [width, setWidth] = createSignal(clamp(readNumber(WIDTH_KEY, DEFAULT_WIDTH)));
  const [dragging, setDragging] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(readCollapsed());

  const groups = createMemo(navGroups);

  let dragOriginX = 0;
  let dragOriginWidth = 0;

  const commitWidth = () => write(WIDTH_KEY, String(Math.round(width())));

  const toggleGroup = (id: NavGroup) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      write(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const onPointerDown = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragOriginX = event.clientX;
    dragOriginWidth = width();
    setDragging(true);
    // Pointer capture is what keeps the drag alive when the cursor crosses the xterm
    // canvas or leaves the window entirely.
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging()) return;
    // Anchored left, so dragging right widens.
    setWidth(clamp(dragOriginWidth + (event.clientX - dragOriginX)));
  };

  const endDrag = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (!dragging()) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Written on pointer-up only: on every move this would hit localStorage 60×/second.
    commitWidth();
  };

  const onSeparatorKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') setWidth(clamp(width() - step));
    else if (event.key === 'ArrowRight') setWidth(clamp(width() + step));
    else return;
    event.preventDefault();
    commitWidth();
  };

  const resetWidth = () => {
    setWidth(DEFAULT_WIDTH);
    commitWidth();
  };

  // A col-resize cursor on <body> keeps the cursor stable while the pointer is captured
  // and wanders over children that set cursors of their own. It has to be an effect, not
  // a call from the pointer handler: `onCleanup` outside a reactive owner never runs.
  createEffect(() => {
    if (!dragging()) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    onCleanup(() => {
      document.body.style.cursor = previous;
    });
  });

  return (
    <nav
      aria-label="Resources"
      style={{ width: `${width()}px` }}
      class={cn(
        'relative flex shrink-0 flex-col overflow-hidden',
        'border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]'
      )}
    >
      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-1.5">
        <Show
          when={groups().length > 0}
          fallback={
            <p class="text-2xs px-3 py-4 leading-relaxed text-[var(--text-tertiary)]">
              No resource kinds are registered yet.
            </p>
          }
        >
          <For each={groups()}>
            {(group) => {
              const isCollapsed = () => collapsed().has(group.id);
              const panelId = `nav-group-${group.id}`;

              return (
                <section class="mb-0.5">
                  <h2>
                    <button
                      type="button"
                      aria-expanded={!isCollapsed()}
                      aria-controls={panelId}
                      onClick={() => toggleGroup(group.id)}
                      class={cn(
                        'text-2xs flex h-6 w-full items-center gap-1 px-2 font-medium',
                        'tracking-wide text-[var(--text-tertiary)] uppercase',
                        'transition-colors hover:text-[var(--text-secondary)]'
                      )}
                    >
                      <ChevronRight
                        size={12}
                        class={cn(
                          'shrink-0 transition-transform duration-100',
                          !isCollapsed() && 'rotate-90'
                        )}
                        aria-hidden="true"
                      />
                      <span class="truncate">{group.label}</span>
                    </button>
                  </h2>

                  <Show when={!isCollapsed()}>
                    <ul id={panelId} class="pb-1">
                      <For each={group.items}>
                        {(descriptor) => (
                          <li>
                            <A
                              href={resourceHref(descriptor.id)}
                              end
                              class={cn(
                                'flex h-[var(--spacing-row)] items-center gap-2 rounded-xs',
                                'mx-1 px-2 transition-colors'
                              )}
                              inactiveClass="text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                              activeClass="bg-[var(--accent-subtle)] text-[var(--accent)]"
                            >
                              <Dynamic
                                component={descriptor.icon}
                                size={14}
                                class="shrink-0 opacity-80"
                                aria-hidden="true"
                              />
                              <span class="min-w-0 flex-1 truncate">{descriptor.title}</span>
                            </A>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </section>
              );
            }}
          </For>
        </Show>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize navigation"
        aria-valuenow={Math.round(width())}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        data-dragging={dragging() ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDblClick={resetWidth}
        onKeyDown={onSeparatorKeyDown}
        class={cn(
          'absolute inset-y-0 -right-px z-10 w-1 cursor-col-resize bg-transparent',
          'transition-colors hover:bg-[var(--accent-border)]',
          'data-[dragging]:bg-[var(--accent)]'
        )}
      />
    </nav>
  );
}
