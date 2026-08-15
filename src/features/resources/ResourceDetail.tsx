/**
 * The one detail panel, for every resource kind.
 *
 * ## Why this is not 39 sidebars
 *
 * The React implementation had a `Sidebar*.tsx` per kind — 6,292 lines — each of which
 * re-implemented the same chrome (`RightSidebarGeneric` + a hand-drawn properties
 * table + an events section) and differed only in which fields it listed. Here the
 * chrome is fixed and the fields come from `descriptor.detail`.
 *
 * ## Tabs
 *
 * Overview, YAML and Events are built in because every kind has them. Anything else is
 * `descriptor.extraTabs` — Pods add Logs and Terminal that way, and this file does not
 * know pods exist. Kobalte mounts a `TabPanel` only while its tab is selected and
 * unmounts it on leave, which is load-bearing: the Logs and Terminal tabs each open a
 * backend stream, and neither may start until the user asks for it or outlive the tab.
 *
 * ## Object identity
 *
 * The Overview panel is keyed on `namespace/name`, so selecting a different row builds
 * a fresh section tree instead of reusing the previous object's component state. That
 * is a correctness requirement, not a nicety: `KeyValueTable`'s reveal state for a
 * Secret must not survive into the next Secret.
 */

import { For, Show, children, createMemo, createResource, createSignal } from 'solid-js';
import { RefreshCw } from 'lucide-solid';

import { listEvents } from '@/api/k8s/events';
import { YamlEditor, YamlView } from '@/features/inspect';
import { cn, resourceKey, type K8sObject } from '@/lib/k8s';
import { selectedName } from '@/stores/clusters';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Spinner } from '@/ui/Spinner';
import { StatusBadge } from '@/ui/StatusBadge';
import { TabPanel, Tabs, type TabItem } from '@/ui/Tabs';
import { toast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';
import { getErrorMessage } from '@/utils/error';

import { AgeCell } from './detail-parts';
import type { DetailSection, ResourceDescriptor } from './types';

export interface ResourceDetailProps<T extends K8sObject> {
  descriptor: ResourceDescriptor<T>;
  item: T;
  /**
   * Re-list after an action that the watch cannot report.
   *
   * Optional because almost nothing needs it: `Restart` and `Scale` land as `MODIFIED`
   * watch events like any other change. A kind with no watch has no other way back.
   */
  onRefetch?: () => void;
}

export function ResourceDetail<T extends K8sObject>(props: ResourceDetailProps<T>) {
  const [tab, setTab] = createSignal('overview');
  const [saving, setSaving] = createSignal(false);

  const name = () => props.item.metadata?.name ?? '';
  const namespace = () => props.item.metadata?.namespace;
  const status = () => props.descriptor.status?.(props.item);
  const actions = () => props.descriptor.actions ?? [];

  const tabs = createMemo<TabItem[]>(() => [
    { value: 'overview', label: 'Overview' },
    { value: 'yaml', label: 'YAML' },
    { value: 'events', label: 'Events' },
    ...(props.descriptor.extraTabs ?? []).map((extra) => ({
      value: extra.id,
      label: extra.label,
    })),
  ]);

  /**
   * The editor hands back whatever the YAML parsed to. There is no runtime schema for
   * `T` and there should not be one — the apiserver is the real validator and rejects a
   * bad manifest with a typed error. All that is checked here is the shape that would
   * otherwise produce a confusing 400: a list, a scalar, or an empty document.
   */
  const asManifest = (parsed: unknown): T => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('The document must be a single Kubernetes object.');
    }
    return parsed as T;
  };

  /**
   * Apply an edited manifest.
   *
   * A named function rather than an inline `onSave={async …}`: an async arrow written
   * directly in a prop is treated as a tracked scope by `eslint-plugin-solid`, and the
   * rule is right in general — a tracked scope only tracks up to its first `await`.
   * Nothing here is meant to be reactive, so it belongs outside the JSX.
   */
  const save = async (parsed: unknown) => {
    const update = props.descriptor.api.update;
    const cluster = selectedName();
    if (!update) return;
    if (!cluster) throw new Error('No cluster is selected.');

    setSaving(true);
    try {
      await update({ name: cluster, namespace: namespace(), manifest: asManifest(parsed) });
      toast.success(`Applied ${props.descriptor.kind} ${name()}`);
    } finally {
      setSaving(false);
    }
  };

  const runAction = (id: string) => {
    const action = actions().find((candidate) => candidate.id === id);
    const cluster = selectedName();
    if (!action || !cluster) return;

    void action
      .run([props.item], { context: cluster, refetch: () => props.onRefetch?.() })
      .catch((err: unknown) => toast.error(getErrorMessage(err)));
  };

  return (
    <div class="flex h-full min-h-0 flex-col">
      <header class="flex shrink-0 flex-col gap-1.5 border-b border-[var(--border-subtle)] px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="selectable min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
            {name()}
          </span>
          <Show when={status()}>
            {(value) => <StatusBadge status={value().status} variant={value().variant} />}
          </Show>
        </div>

        <div class="text-2xs flex flex-wrap items-center gap-1.5 text-[var(--text-tertiary)]">
          <span>{props.descriptor.kind}</span>
          <Show when={namespace()}>
            {(value) => (
              <>
                <span aria-hidden="true">·</span>
                <Badge variant="accent" size="sm">
                  {value()}
                </Badge>
              </>
            )}
          </Show>
          <span aria-hidden="true">·</span>
          <AgeCell timestamp={props.item.metadata?.creationTimestamp} />
        </div>

        <Show when={actions().length > 0}>
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <For each={actions()}>
              {(action) => (
                <Show when={action.available?.([props.item]) ?? true}>
                  <Tooltip
                    content={action.disabledReason?.([props.item]) ?? ''}
                    disabled={!action.disabledReason?.([props.item])}
                  >
                    <Button
                      size="sm"
                      variant={action.danger ? 'danger' : 'secondary'}
                      icon={action.icon}
                      disabled={Boolean(action.disabledReason?.([props.item]))}
                      onClick={() => runAction(action.id)}
                    >
                      {action.label}
                    </Button>
                  </Tooltip>
                </Show>
              )}
            </For>
          </div>
        </Show>
      </header>

      <Tabs
        class="min-h-0 flex-1"
        items={tabs()}
        value={tab()}
        onChange={setTab}
        listClass="px-3 text-2xs"
      >
        <TabPanel value="overview" class="p-3">
          {/* Keyed on the object identity: a new selection must not inherit the previous
              object's section state. See the file header. */}
          <Show when={resourceKey(props.item)} keyed>
            {(_key) => (
              <Show
                when={(props.descriptor.detail ?? []).length > 0}
                fallback={
                  <EmptyState
                    title="No overview"
                    description="This kind has no detail sections yet."
                  />
                }
              >
                <div class="flex flex-col gap-4">
                  <For each={props.descriptor.detail}>
                    {(section) => <SectionView section={section} item={props.item} />}
                  </For>
                </div>
              </Show>
            )}
          </Show>
        </TabPanel>

        <TabPanel value="yaml" class="min-h-0 p-3">
          {/* Read-only when the kind has no `update`: showing an editable pane that
              cannot save is worse than showing a viewer. */}
          <Show
            when={props.descriptor.api.update}
            fallback={<YamlView object={props.item} class="h-full" />}
          >
            <YamlEditor class="h-full" object={props.item} saving={saving()} onSave={save} />
          </Show>
        </TabPanel>

        <TabPanel value="events" class="p-3">
          <EventsPanel kind={props.descriptor.kind} name={name()} namespace={namespace()} />
        </TabPanel>

        <For each={props.descriptor.extraTabs}>
          {(extra) => (
            <TabPanel value={extra.id} class="min-h-0 p-3">
              {extra.render(props.item)}
            </TabPanel>
          )}
        </For>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

interface SectionViewProps<T> {
  section: DetailSection<T>;
  item: T;
}

/**
 * One collapsible section.
 *
 * `render` is resolved through `children()` so it runs exactly once per object. Calling
 * it twice — once to test for the `null` that means "omit this section", once to
 * render — would build the subtree twice and run any effects inside it twice.
 */
function SectionView<T>(props: SectionViewProps<T>) {
  // `undefined` means "follow the descriptor"; a click pins it. Seeding a signal from
  // `props.section.collapsed` instead would snapshot the prop at creation, which is the
  // props-copied-into-state React habit `.claude/frontend.md` calls out.
  const [override, setOverride] = createSignal<boolean | undefined>();
  const open = () => override() ?? !props.section.collapsed;

  const body = children(() => props.section.render(props.item));

  return (
    <Show when={body() !== null}>
      <section class="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOverride(!open())}
          aria-expanded={open()}
          class={cn(
            'text-2xs flex items-center gap-1 font-medium tracking-wide uppercase',
            'text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]'
          )}
        >
          <span
            class={cn('transition-transform', open() ? 'rotate-90' : 'rotate-0')}
            aria-hidden="true"
          >
            ›
          </span>
          {props.section.title}
        </button>

        <Show when={open()}>
          <div class="pl-2">{body()}</div>
        </Show>
      </section>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

interface EventsPanelProps {
  kind: string;
  name: string;
  namespace?: string;
}

const eventVariant = (type?: string) => {
  switch (type) {
    case 'Normal':
      return 'success';
    case 'Warning':
      return 'warning';
    default:
      return 'secondary';
  }
};

const eventTime = (event: { lastTimestamp?: string; metadata?: { creationTimestamp?: string } }) =>
  event.lastTimestamp ?? event.metadata?.creationTimestamp;

/**
 * Events for one object, newest first.
 *
 * Fetched rather than watched, and only while the tab is open. Events are the highest
 * churn resource in a busy cluster and this panel shows at most a few dozen for a
 * single object — a watch over the whole `Event` collection to render them would cost
 * far more than the one field-selected list this does.
 */
function EventsPanel(props: EventsPanelProps) {
  const [events, { refetch }] = createResource(
    () => ({
      context: selectedName(),
      namespace: props.namespace,
      kind: props.kind,
      name: props.name,
    }),
    async (target) => {
      if (!target.context || !target.name) return [];

      const list = await listEvents({
        context: target.context,
        namespace: target.namespace,
        involvedObject: { name: target.name, kind: target.kind },
      });

      return [...list].sort((a, b) => {
        const left = eventTime(a);
        const right = eventTime(b);
        return (right ? Date.parse(right) : 0) - (left ? Date.parse(left) : 0);
      });
    }
  );

  // `resource.latest` rethrows while the resource is errored, so every read goes
  // through here — the error branch below is rendered *from* the same signal.
  const items = () => (events.error ? [] : (events.latest ?? []));

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <span class="tnum text-2xs text-[var(--text-tertiary)]">{items().length} events</span>
        <div class="flex-1" />
        <IconButton
          icon={RefreshCw}
          label="Reload events"
          size="sm"
          onClick={() => void refetch()}
        />
      </div>

      <Show
        when={!events.error}
        fallback={<ErrorState error={events.error} onRetry={() => void refetch()} />}
      >
        <Show
          when={events.state !== 'pending'}
          fallback={
            <div class="text-2xs flex items-center gap-2 py-6 text-[var(--text-tertiary)]">
              <Spinner size={13} />
              Loading events…
            </div>
          }
        >
          <Show
            when={items().length > 0}
            fallback={
              <EmptyState
                title="No events"
                description="Nothing has happened to this object recently."
              />
            }
          >
            <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
              <For each={items()}>
                {(event) => (
                  <div class="flex flex-col gap-0.5 py-1.5">
                    <div class="flex items-baseline gap-2">
                      <Badge variant={eventVariant(event.type)} size="sm">
                        {event.type ?? 'Unknown'}
                      </Badge>
                      <span class="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                        {event.reason ?? '—'}
                      </span>
                      <Show when={(event.count ?? 1) > 1}>
                        <span class="tnum text-2xs text-[var(--text-tertiary)]">
                          ×{event.count}
                        </span>
                      </Show>
                      <AgeCell
                        timestamp={eventTime(event)}
                        class="text-2xs w-10 shrink-0 text-right text-[var(--text-tertiary)]"
                      />
                    </div>

                    <p class="selectable text-2xs leading-snug text-[var(--text-secondary)]">
                      {event.message ?? '—'}
                    </p>

                    <Show when={event.source?.component}>
                      {(component) => (
                        <span class="text-2xs text-[var(--text-tertiary)]">{component()}</span>
                      )}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
