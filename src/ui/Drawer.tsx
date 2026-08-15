/**
 * Right-hand resource detail panel.
 *
 * Explicitly **not** a modal. There is no overlay, no focus trap and no scroll lock:
 * the table behind stays clickable, so you can walk down a list of pods with the panel
 * open and watch it follow. That is the whole reason this is not `Dialog`.
 *
 * Resizing is 30 lines of pointer events on a 4px strip, not a drag library. Pointer
 * capture is what makes it work: once the strip captures the pointer, every subsequent
 * `pointermove` retargets to it, so the drag survives the cursor crossing an iframe,
 * the xterm canvas, or leaving the window. The strip is also a focusable
 * `role="separator"` that resizes with the arrow keys, because a mouse-only affordance
 * is not an affordance for everyone.
 *
 * Width is persisted per `storageKey` so a user who widens the YAML panel does not have
 * to do it again next launch, and only on pointer-up — writing on every move would hit
 * localStorage 60 times a second.
 *
 * Positioning is `absolute`, so **the parent must be a positioned element**. Without
 * that the panel escapes to the viewport and covers the title bar.
 */

import {
  Show,
  children,
  createEffect,
  createSignal,
  onCleanup,
  splitProps,
  type JSX,
} from 'solid-js';
import { X } from 'lucide-solid';

import { cn } from '@/lib/k8s';

import { IconButton } from './IconButton';

const DEFAULT_STORAGE_KEY = 'kumate.drawer.width';

const readStoredWidth = (key: string, fallback: number): number => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    // Private-mode style localStorage failures must not take the panel down with them.
    return fallback;
  }
};

const writeStoredWidth = (key: string, width: number): void => {
  try {
    window.localStorage.setItem(key, String(Math.round(width)));
  } catch {
    /* Persistence is a convenience, never a requirement. */
  }
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Header content. Usually the resource name. */
  title?: JSX.Element;
  /** Accessible name for the region. Defaults to `'Details'`. */
  ariaLabel?: string;
  /** localStorage key for the persisted width. Vary it per panel kind. */
  storageKey?: string;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  /** Pinned to the bottom, outside the scroll area. */
  footer?: JSX.Element;
  class?: string;
  children?: JSX.Element;
}

export function Drawer(props: DrawerProps) {
  const [local] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'ariaLabel',
    'storageKey',
    'minWidth',
    'maxWidth',
    'defaultWidth',
    'footer',
    'class',
    'children',
  ]);

  // Memoised so the `<Show>` condition and the render below do not each build the node.
  const title = children(() => local.title);
  const footer = children(() => local.footer);

  const storageKey = () => local.storageKey ?? DEFAULT_STORAGE_KEY;
  const minWidth = () => local.minWidth ?? 360;
  const maxWidth = () => local.maxWidth ?? 900;
  const defaultWidth = () => local.defaultWidth ?? 480;

  const clamp = (value: number) => Math.min(maxWidth(), Math.max(minWidth(), value));

  const [width, setWidth] = createSignal(clamp(readStoredWidth(storageKey(), defaultWidth())));
  const [dragging, setDragging] = createSignal(false);

  let panel: HTMLElement | undefined;
  let dragOriginX = 0;
  let dragOriginWidth = 0;

  const commit = () => writeStoredWidth(storageKey(), width());

  const onPointerDown = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragOriginX = event.clientX;
    dragOriginWidth = width();
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging()) return;
    // The panel is anchored right, so dragging left (a smaller clientX) widens it.
    setWidth(clamp(dragOriginWidth + (dragOriginX - event.clientX)));
  };

  const endDrag = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (!dragging()) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commit();
  };

  const onSeparatorKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') setWidth(clamp(width() + step));
    else if (event.key === 'ArrowRight') setWidth(clamp(width() - step));
    else return;
    event.preventDefault();
    commit();
  };

  const resetWidth = () => {
    setWidth(clamp(defaultWidth()));
    commit();
  };

  // Escape closes even when focus is out in the table, which is where it usually is —
  // the panel is non-modal, so it never owns the keyboard.
  createEffect(() => {
    if (!local.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') local.onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  // A col-resize cursor on <body> keeps it stable while the pointer is captured and
  // wanders over children with cursors of their own.
  createEffect(() => {
    if (!dragging()) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    onCleanup(() => {
      document.body.style.cursor = previous;
    });
  });

  return (
    <Show when={local.open}>
      <aside
        ref={(element) => {
          panel = element;
          // Refs fire before insertion; focus once the element is actually in the DOM.
          queueMicrotask(() => panel?.focus());
        }}
        tabIndex={-1}
        role="complementary"
        aria-label={local.ariaLabel ?? 'Details'}
        style={{ width: `${width()}px` }}
        class={cn(
          'animate-in absolute inset-y-0 right-0 z-30 flex flex-col outline-none',
          'border-l border-[var(--border-default)] bg-[var(--surface-raised)]',
          'shadow-[var(--shadow-overlay)]',
          local.class
        )}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuenow={Math.round(width())}
          aria-valuemin={minWidth()}
          aria-valuemax={maxWidth()}
          tabIndex={0}
          data-dragging={dragging() ? '' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDblClick={resetWidth}
          onKeyDown={onSeparatorKeyDown}
          class={cn(
            'absolute inset-y-0 -left-px z-10 w-1 cursor-col-resize bg-transparent',
            'transition-colors hover:bg-[var(--accent-border)]',
            'data-[dragging]:bg-[var(--accent)]'
          )}
        />

        <Show when={title()}>
          <header
            class={cn(
              'flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)]',
              'pr-1.5 pl-3'
            )}
          >
            <div class="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
              {title()}
            </div>
            <IconButton icon={X} label="Close panel" size="sm" onClick={local.onClose} />
          </header>
        </Show>

        <div class="min-h-0 flex-1 overflow-y-auto">{local.children}</div>

        <Show when={footer()}>
          <footer class="shrink-0 border-t border-[var(--border-subtle)] px-3 py-2">
            {footer()}
          </footer>
        </Show>
      </aside>
    </Show>
  );
}
