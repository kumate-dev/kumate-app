/**
 * The three-region shell: top bar, nav + content, status bar.
 *
 * A CSS grid rather than nested flex columns, because the middle row must be exactly
 * "whatever is left" — `minmax(0, 1fr)` is what stops a long resource table from pushing
 * the status bar off the bottom of the window, and it is the one thing a flex `flex-1`
 * gets wrong here (a flex item's `min-height: auto` lets its content win).
 *
 * **The content region is a positioned ancestor, on purpose.** `ui/Drawer` is
 * `absolute inset-y-0 right-0`, not `fixed`, so the resource detail panel sits inside the
 * content area and leaves the nav sidebar and both bars uncovered. Remove `relative` from
 * `<main>` and the drawer escapes to the viewport and covers the top bar.
 *
 * The palette lives outside the grid. It portals to `<body>`, so it renders nothing here,
 * but keeping it out of the grid means it can never be mistaken for a fourth row.
 */

import { type JSX } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';

import { CommandPalette } from './CommandPalette';
import { NavSidebar } from './NavSidebar';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import { useGlobalShortcuts } from './shortcuts';

export function AppLayout(props: RouteSectionProps): JSX.Element {
  // Installed here rather than in `App` so the handler is torn down with the shell and
  // so it sits inside the router context it needs for ⌘1..9.
  useGlobalShortcuts();

  return (
    <>
      <div class="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-(--surface-base)">
        <TopBar />

        <div class="flex min-h-0 min-w-0 overflow-hidden">
          <NavSidebar />
          <main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {props.children}
          </main>
        </div>

        <StatusBar />
      </div>

      <CommandPalette />
    </>
  );
}
