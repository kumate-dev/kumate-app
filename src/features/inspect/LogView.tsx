/**
 * Pod log viewer.
 *
 * Owns its subscription: give it a pod and it streams, and it tears the stream down
 * on cleanup or whenever the target changes. Three things are deliberately different
 * from `components/common/BottomLogViewer.tsx` + `hooks/useViewPodLogs.ts`:
 *
 * 1. **Capped line array, not a growing string.** The React viewer did
 *    `setLogs(prev => prev + line + '\n')`, so a followed stream grew without bound
 *    and every line rebuilt the whole document. Lines live in a fixed-size ring here
 *    (`MAX_LINES`, oldest dropped first) and the batched `LOG_LINES` event is appended
 *    in one go.
 * 2. **Virtualized.** 5,000 lines were 5,000 text nodes inside one `<pre>`.
 * 3. **The stream is actually stopped.** `stopStreaming` called
 *    `unwatch({ name: contextName })`, but the `WatchManager` is keyed by event-channel
 *    name (`k8s://<ctx>/pod_logs/<ns>/<pod>[/<container>]`), so a bare context name
 *    never matched and the backend kept following the log until the app exited.
 */

import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { ArrowDownToLine, Download, Search, Trash2, WrapText } from 'lucide-solid';
import { listPods, watchPodLogs, type LogEvent } from '@/api/k8s/pods';
import { unwatch } from '@/api/k8s/unwatch';
import { cn } from '@/lib/k8s';
import { getErrorMessage } from '@/utils/error';

export interface LogViewProps {
  context: string;
  namespace: string;
  pod: string;
  container?: string;
  class?: string;
}

/** Hard cap on the retained buffer. A followed stream is otherwise unbounded. */
const MAX_LINES = 5000;

/** Lines requested when the stream opens. */
const TAIL_LINES = 500;

/** `text-xs` at `leading-[1.5]`. Exact for unwrapped lines; an estimate when wrapped. */
const LINE_HEIGHT = 18;

/** How close to the bottom still counts as "at the bottom" for the follow toggle. */
const FOLLOW_EPSILON_PX = 24;

type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'ended' | 'error';

export function LogView(props: LogViewProps) {
  /**
   * The buffer is mutated in place and the signal is `equals: false`. Copying a
   * 5,000-element array on every 100 ms batch would be pure waste; nothing outside
   * this component holds the array, and every consumer is a memo that re-runs on
   * notification rather than on identity change.
   */
  let buffer: string[] = [];
  const [lines, setLines] = createSignal<string[]>(buffer, { equals: false });

  const [filter, setFilter] = createSignal('');
  const [follow, setFollow] = createSignal(true);
  const [wrap, setWrap] = createSignal(false);
  const [status, setStatus] = createSignal<StreamStatus>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const [containerOverride, setContainerOverride] = createSignal<string | undefined>();

  const append = (incoming: readonly string[]) => {
    if (incoming.length === 0) return;
    buffer.push(...incoming);
    if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
    setLines(buffer);
  };

  const clear = () => {
    buffer = [];
    setLines(buffer);
  };

  /**
   * The container list, for the picker. There is no `get_pod` command, so the pod is
   * picked out of a namespace listing — one round trip, once per target.
   */
  const [podInfo] = createResource(
    () => ({ context: props.context, namespace: props.namespace, pod: props.pod }),
    async (target) => {
      const pods = await listPods({ name: target.context, namespaces: [target.namespace] });
      return pods.find((item) => item.metadata?.name === target.pod) ?? null;
    }
  );

  const containers = createMemo<string[]>(() => {
    // `.state` is safe to read while the resource is in flight or errored; calling the
    // resource itself would re-throw the failure into the render.
    if (podInfo.state !== 'ready') return [];
    const spec = podInfo()?.spec;
    if (!spec) return [];
    return [
      ...(spec.initContainers ?? []).map((item) => item.name),
      ...spec.containers.map((item) => item.name),
    ];
  });

  /** Whether the pod lookup has settled either way — see the subscription effect. */
  const targetResolved = () => podInfo.state === 'ready' || podInfo.state === 'errored';

  const container = createMemo(() => containerOverride() ?? props.container ?? containers()[0]);

  const filtered = createMemo(
    () => {
      const query = filter().trim().toLowerCase();
      const all = lines();
      return query ? all.filter((line) => line.toLowerCase().includes(query)) : all;
    },
    undefined,
    // Same reason as `lines`: the unfiltered branch returns the buffer itself, so
    // identity comparison would swallow every update.
    { equals: false }
  );

  const handleEvent = (event: LogEvent) => {
    switch (event.type) {
      // The normal path: the backend coalesces up to 64 lines or 100 ms per event.
      case 'LOG_LINES':
        if (event.logs && event.logs.length > 0) append(event.logs);
        break;
      // Legacy one-line shape, still accepted so an older backend keeps working.
      case 'LOG_LINE':
        if (event.log) append([event.log]);
        break;
      case 'LOG_ERROR':
        setError(event.error ?? 'Log stream error');
        setStatus('error');
        break;
      case 'LOG_COMPLETED':
        setStatus('ended');
        break;
    }
  };

  createEffect(() => {
    const context = props.context;
    const namespace = props.namespace;
    const pod = props.pod;

    // Wait for the container list before opening the stream. Starting without a
    // container and restarting once the list arrives would throw away the first
    // batch, and the apiserver rejects a container-less request on a multi-container
    // pod anyway. An errored lookup counts as settled: fall back to the prop.
    if (!context || !targetResolved()) return;
    const containerName = container();

    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    let channel: string | null = null;

    clear();
    setError(null);
    setStatus('connecting');

    void (async () => {
      try {
        const started = await watchPodLogs({
          context,
          namespace,
          podName: pod,
          containerName,
          tailLines: TAIL_LINES,
          onEvent: (event) => {
            if (!disposed) handleEvent(event);
          },
        });

        if (disposed) {
          started.unlisten();
          void unwatch({ name: started.eventName });
          return;
        }

        unlisten = started.unlisten;
        channel = started.eventName;
        setStatus('streaming');
      } catch (err) {
        if (disposed) return;
        setError(getErrorMessage(err));
        setStatus('error');
      }
    })();

    onCleanup(() => {
      disposed = true;
      unlisten?.();
      // Stops the backend task. Without this the pod log stream outlives the pane.
      if (channel) void unwatch({ name: channel });
      setStatus('idle');
    });
  });

  let scrollEl: HTMLDivElement | undefined;

  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return filtered().length;
    },
    getScrollElement: () => scrollEl ?? null,
    estimateSize: () => LINE_HEIGHT,
    overscan: 24,
  });

  // Cached row heights are only meaningful for the content that was measured. Both of
  // these change which line sits at which index, or how tall it is.
  createEffect(() => {
    wrap();
    filter();
    virtualizer.measure();
  });

  const atBottom = () => {
    if (!scrollEl) return true;
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <= FOLLOW_EPSILON_PX;
  };

  // Scrolling up disengages follow; scrolling back to the bottom re-engages it.
  const onScroll = () => setFollow(atBottom());

  createEffect(() => {
    const count = filtered().length;
    if (!follow() || count === 0) return;

    // Deferred by a frame: the sizer element has not grown yet at this point, so
    // scrolling now would land short of the new last line.
    const frame = requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const download = async () => {
    try {
      const suffix = container() ? `-${container()}` : '';
      const path = await save({
        defaultPath: `${props.pod}${suffix}.log`,
        filters: [{ name: 'Log', extensions: ['log', 'txt'] }],
      });
      if (!path) return;
      await writeTextFile(path, lines().join('\n'));
    } catch (err) {
      setError(`Download failed: ${getErrorMessage(err)}`);
    }
  };

  const toggleClass = (active: boolean) =>
    cn(
      'flex items-center gap-1 rounded-md border px-2 py-1 text-2xs',
      active
        ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)]'
        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
    );

  return (
    <div class={cn('flex h-full min-h-0 w-full flex-col gap-2', props.class)}>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2">
          <Search class="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={filter()}
            onInput={(event) => setFilter(event.currentTarget.value)}
            placeholder="Filter lines"
            spellcheck={false}
            class="text-2xs min-w-0 flex-1 bg-transparent py-1 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <Show when={containers().length > 1}>
          <select
            value={container() ?? ''}
            onChange={(event) => setContainerOverride(event.currentTarget.value)}
            title="Container"
            class="text-2xs rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[var(--text-primary)]"
          >
            <For each={containers()}>{(name) => <option value={name}>{name}</option>}</For>
          </select>
        </Show>

        <button
          type="button"
          onClick={() => setFollow((value) => !value)}
          title="Follow new lines"
          class={toggleClass(follow())}
        >
          <ArrowDownToLine class="h-3 w-3" />
          Follow
        </button>

        <button
          type="button"
          onClick={() => setWrap((value) => !value)}
          title="Wrap long lines"
          class={toggleClass(wrap())}
        >
          <WrapText class="h-3 w-3" />
          Wrap
        </button>

        <button
          type="button"
          onClick={() => void download()}
          title="Download logs"
          class={toggleClass(false)}
        >
          <Download class="h-3 w-3" />
          Save
        </button>

        <button type="button" onClick={clear} title="Clear buffer" class={toggleClass(false)}>
          <Trash2 class="h-3 w-3" />
          Clear
        </button>

        <span class="tnum text-2xs text-[var(--text-tertiary)]">
          {filtered().length}
          <Show when={filter().trim()}> / {lines().length}</Show> lines
        </span>
      </div>

      <div class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
        <div ref={scrollEl} onScroll={onScroll} class="selectable h-full overflow-auto">
          <div class="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            <For each={virtualizer.getVirtualItems()}>
              {(row) => (
                <div
                  ref={(element) => queueMicrotask(() => virtualizer.measureElement(element))}
                  data-index={row.index}
                  class={cn(
                    'absolute left-0 px-3 font-mono text-xs leading-[1.5] text-[var(--text-secondary)]',
                    wrap()
                      ? 'w-full break-all whitespace-pre-wrap'
                      : 'w-max min-w-full whitespace-pre'
                  )}
                  style={{ top: `${row.start}px` }}
                >
                  {filtered()[row.index]}
                </div>
              )}
            </For>
          </div>
        </div>

        <Show when={filtered().length === 0}>
          <div class="text-2xs pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--text-tertiary)]">
            {status() === 'connecting'
              ? 'Connecting…'
              : filter().trim() && lines().length > 0
                ? 'No lines match the filter'
                : 'No logs yet'}
          </div>
        </Show>
      </div>

      <Show when={error()}>
        {(message) => (
          <div class="selectable text-2xs rounded-md border border-[var(--status-danger)] bg-[var(--status-danger-subtle)] px-2 py-1 text-[var(--status-danger)]">
            {message()}
          </div>
        )}
      </Show>
    </div>
  );
}

export default LogView;
