/**
 * The bottom strip: is the cluster reachable, what version, and what is this app doing.
 *
 * ## Why the watcher and cache counts are here at all
 *
 * The backend caps watches at `MAX_WATCHERS` and a leaked watch is invisible from the
 * UI — the symptom is a page that silently stops updating once the cap is hit. Putting
 * the live count on screen turns "watches leak" from a bug you discover in production
 * into a number you watch climb while you use the app.
 *
 * ## Polling
 *
 * Every other number in this application arrives by watch. These two cannot: they
 * describe the watch layer itself, so there is nothing to watch. A 5s poll is the
 * compromise, and it is gated on `document.visibilityState`: an idle monitoring tool
 * sitting behind another window must cost nothing. The same gate is why
 * `stores/clock.ts` stops its interval when hidden.
 */

import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
  type JSX,
} from 'solid-js';

import { checkContextConnection, getContextVersion } from '@/api/k8s/contexts';
import { getWatchDiagnostics, type WatchDiagnostics } from '@/api/k8s/diagnostics';
import { cn } from '@/lib/k8s';
import { isConnected, refreshConnections, selectedContext, selectedName } from '@/stores/clusters';
import { Tooltip } from '@/ui/Tooltip';

import { refreshRequests } from './shortcuts';

const POLL_INTERVAL_MS = 5000;

/** The cap is per-process, so 80% of it is a genuine warning, not decoration. */
const WATCHER_WARN_RATIO = 0.8;

const counter = new Intl.NumberFormat();

type Health = 'none' | 'disconnected' | 'checking' | 'unreachable' | 'connected';

const HEALTH_LABEL: Record<Health, string> = {
  none: 'No cluster selected',
  disconnected: 'Disconnected',
  checking: 'Connecting…',
  unreachable: 'Unreachable',
  connected: 'Connected',
};

const HEALTH_DOT: Record<Health, string> = {
  none: 'bg-[var(--text-tertiary)]',
  disconnected: 'bg-[var(--status-info)]',
  checking: 'bg-[var(--status-warn)]',
  unreachable: 'bg-[var(--status-danger)]',
  connected: 'bg-[var(--status-ok)]',
};

const HEALTH_TEXT: Record<Health, string> = {
  none: 'text-[var(--text-tertiary)]',
  disconnected: 'text-[var(--status-info)]',
  checking: 'text-[var(--status-warn)]',
  unreachable: 'text-[var(--status-danger)]',
  connected: 'text-[var(--text-secondary)]',
};

/** `getContextVersion` returns whatever the apiserver reports; normalise the `v`. */
const formatVersion = (version: string | undefined): string | undefined => {
  const trimmed = version?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
};

function Separator(): JSX.Element {
  return (
    <span class="text-[var(--text-tertiary)]" aria-hidden="true">
      ·
    </span>
  );
}

export function StatusBar(): JSX.Element {
  /**
   * The source is `undefined` while there is nothing to probe, which is how a resource
   * is told "do not fetch" — cheaper and less error-prone than fetching and discarding.
   */
  const probeTarget = createMemo(() => {
    const name = selectedName();
    if (!name || !isConnected(name)) return undefined;
    return name;
  });

  const [health, { refetch: refetchHealth }] = createResource(probeTarget, async (name) => {
    // `check_context_connection` throws when the cluster is unreachable, so this doubles
    // as the liveness probe and saves a second round trip.
    await checkContextConnection(name);
    return getContextVersion(name);
  });

  const state = createMemo<Health>(() => {
    if (!selectedName()) return 'none';
    if (!probeTarget()) return 'disconnected';
    if (health.loading) return 'checking';
    if (health.error !== undefined) return 'unreachable';
    return 'connected';
  });

  /**
   * Guarded behind `state()`: reading a Solid resource that settled to an error
   * *re-throws* it, so `health()` must never be touched outside the connected state.
   */
  const version = createMemo(() => (state() === 'connected' ? formatVersion(health()) : undefined));

  const [diagnostics, setDiagnostics] = createSignal<WatchDiagnostics | null>(null);

  let timer: ReturnType<typeof setInterval> | undefined;

  const poll = async () => {
    try {
      setDiagnostics(await getWatchDiagnostics());
    } catch {
      // A failed diagnostics call is not worth a toast: the numbers simply go stale, and
      // the IPC failure that caused it will have surfaced somewhere the user can act on.
    }
  };

  const start = () => {
    if (timer !== undefined) return;
    void poll();
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  };

  const stop = () => {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else start();
  };

  onMount(() => {
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onCleanup(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // ⌘R and the palette's "Refresh data" land here. `defer` so the initial run of the
  // effect does not duplicate the work `onMount` already did.
  createEffect(
    on(
      refreshRequests,
      () => {
        void refreshConnections();
        void refetchHealth();
        void poll();
      },
      { defer: true }
    )
  );

  const watchers = () => diagnostics()?.watchers ?? 0;
  const maxWatchers = () => diagnostics()?.maxWatchers ?? 0;

  const watchersNearCap = () =>
    maxWatchers() > 0 && watchers() >= maxWatchers() * WATCHER_WARN_RATIO;

  return (
    <footer
      class={cn(
        'text-2xs flex h-6 shrink-0 items-center gap-2 overflow-hidden px-2',
        'border-t border-[var(--border-default)] bg-[var(--surface-raised)]',
        'text-[var(--text-secondary)]'
      )}
    >
      <span
        class={cn('flex min-w-0 items-center gap-1.5', HEALTH_TEXT[state()])}
        role="status"
        aria-live="polite"
      >
        <span
          class={cn('size-1.5 shrink-0 rounded-full', HEALTH_DOT[state()])}
          aria-hidden="true"
        />
        <span class="truncate">{HEALTH_LABEL[state()]}</span>
      </span>

      <Show when={selectedContext()}>
        {(context) => (
          <>
            <Separator />
            <span class="min-w-0 truncate text-[var(--text-tertiary)]">{context().name}</span>
          </>
        )}
      </Show>

      <Show when={version()}>
        {(value) => (
          <>
            <Separator />
            <span class="tnum shrink-0">{value()}</span>
          </>
        )}
      </Show>

      <div class="ml-auto flex shrink-0 items-center gap-2">
        <Show when={diagnostics()}>
          {(report) => (
            <>
              <Tooltip
                placement="top-end"
                content={
                  <Show
                    when={report().active.length > 0}
                    fallback={<span>No active watches.</span>}
                  >
                    <div class="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
                      <span class="text-[var(--text-tertiary)]">
                        {`${report().active.length} active · ${report().cachedClients} cached client${
                          report().cachedClients === 1 ? '' : 's'
                        }`}
                      </span>
                      <For each={report().active}>
                        {(name) => <span class="font-mono">{name}</span>}
                      </For>
                    </div>
                  </Show>
                }
              >
                <span
                  class={cn(
                    'tnum cursor-default',
                    watchersNearCap() ? 'text-[var(--status-warn)]' : 'text-[var(--text-secondary)]'
                  )}
                >
                  {maxWatchers() > 0
                    ? `${watchers()}/${maxWatchers()} watchers`
                    : `${watchers()} watchers`}
                </span>
              </Tooltip>

              <Separator />

              <span class="tnum">
                {`${counter.format(report().cachedObjects)} object${
                  report().cachedObjects === 1 ? '' : 's'
                }`}
              </span>
            </>
          )}
        </Show>
      </div>
    </footer>
  );
}
