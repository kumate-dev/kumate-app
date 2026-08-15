/**
 * Router, layout and the one-time application bootstrap.
 *
 * ## Why there is a router at all
 *
 * The React app had a single `/` route and navigated with `useState<PageKey>` inside
 * `Home.tsx`. The current screen was therefore not in the URL: it could not be restored
 * after a reload, back and forward did nothing, and there was no way to say "look at
 * this". Route state in the URL is the fix, and `/r/:id` is deliberately the *only*
 * shape — the descriptor id is the route segment, so adding a kind adds a route.
 *
 * ## Why `HashRouter`
 *
 * Tauri serves `frontendDist` through a custom protocol (`tauri://localhost`, or
 * `http://tauri.localhost` on Windows) that resolves a request path to a file on disk.
 * There is no server and no SPA rewrite rule, so a history-API path like `/r/pods` maps
 * to a file that does not exist: the app works until the WebView reloads, and then it
 * 404s. Everything after `#` never reaches the protocol handler, so `HashRouter` is
 * reload-safe on every platform Tauri targets, with no build or config coupling.
 *
 * `MemoryRouter` would also avoid the 404, but it throws the URL away entirely — which
 * is most of the reason for adding a router here — so it is the wrong trade.
 */

import { Show, createMemo, onMount, type JSX } from 'solid-js';
import { HashRouter, Navigate, Route, useParams } from '@solidjs/router';
import { Boxes } from 'lucide-solid';

import { RESOURCES, resourceById } from '@/features/resources/registry';
import { ResourceView } from '@/features/resources/ResourceView';
import { EmptyState } from '@/ui/EmptyState';
import { Toaster } from '@/ui/Toast';
import { initClusters } from '@/stores/clusters';

import { AppLayout } from './AppLayout';
import { resourceHref } from './NavSidebar';

/** Where `/` lands. The first registered kind, which is `NAV_GROUPS`-ordered by design. */
const firstResourceHref = (): string | undefined => {
  const first = RESOURCES[0];
  return first ? resourceHref(first.id) : undefined;
};

function IndexRoute(): JSX.Element {
  const href = firstResourceHref();

  return (
    <Show
      when={href}
      fallback={
        <EmptyState
          icon={Boxes}
          title="No resource kinds registered"
          description="Add a descriptor to src/features/resources/registry.ts to give the app something to show."
        />
      }
    >
      {(target) => <Navigate href={target()} />}
    </Show>
  );
}

function ResourceRoute(): JSX.Element {
  const params = useParams();
  const id = () => params.id ?? '';
  const descriptor = createMemo(() => resourceById(id()));

  return (
    <Show
      // `keyed` is load-bearing: `ResourceView` reads `descriptor.api` once, at setup, to
      // open its watch. Without it, navigating pods → deployments would reuse the same
      // component instance and keep watching pods.
      keyed
      when={descriptor()}
      fallback={
        <EmptyState
          icon={Boxes}
          title={`Unknown resource “${id()}”`}
          description="This kind is not registered. It may not have been ported yet, or the link may be stale."
        />
      }
    >
      {(found) => <ResourceView descriptor={found} />}
    </Show>
  );
}

export function App(): JSX.Element {
  // Connection state and the auto-selected cluster. Fire-and-forget: `initClusters`
  // handles its own failures, and nothing in the shell blocks on it.
  onMount(() => {
    void initClusters();
  });

  return (
    <>
      <HashRouter root={AppLayout}>
        <Route path="/" component={IndexRoute} />
        <Route path="/r/:id" component={ResourceRoute} />
        {/* Anything else is a stale link, not a crash. */}
        <Route path="*" component={IndexRoute} />
      </HashRouter>

      <Toaster />
    </>
  );
}
