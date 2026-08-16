import { batch, createMemo, createSignal, For, Show } from 'solid-js';
import { FileCode2, RefreshCw, Trash2 } from 'lucide-solid';
import { createResourceList } from '@/lib/createResourceList';
import { compareValues, createDelayedLoading, resourceKey, type K8sObject } from '@/lib/k8s';
import { selectedName } from '@/stores/clusters';
import { namespaceFilter } from '@/stores/namespaces';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/Dialog';
import { Drawer } from '@/ui/Drawer';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { SearchInput } from '@/ui/Input';
import { toast } from '@/ui/Toast';
import { getErrorMessage } from '@/utils/error';
import { ResourceDetail } from './ResourceDetail';
import { ResourceTable } from './ResourceTable';
import type { ResourceDescriptor, SortDirection } from './types';

export interface ResourceViewProps<T extends K8sObject> {
  descriptor: ResourceDescriptor<T>;
}

/**
 * The single screen behind every resource kind.
 *
 * Owns everything that used to be re-implemented in each of the 37 `pages/*.tsx` and
 * 38 `Pane*.tsx` files: search, sort, selection, the detail drawer, delete
 * confirmation and toasts. A descriptor supplies only the parts that genuinely differ.
 */
export function ResourceView<T extends K8sObject>(props: ResourceViewProps<T>) {
  // The descriptor is read once, at setup, and deliberately not tracked: a screen is
  // bound to one kind for its lifetime. `App.tsx` wraps this in `<Show keyed>` on the
  // route id, so navigating pods -> deployments disposes this component and builds a
  // new one. Making it reactive instead would keep the old watch alive.
  const list = createResourceList<T>(
    // eslint-disable-next-line solid/reactivity
    props.descriptor.api,
    selectedName,
    // Cluster-scoped kinds ignore the namespace filter entirely.
    () => (props.descriptor.namespaced ? namespaceFilter() : undefined)
  );

  const [search, setSearch] = createSignal('');
  const [selection, setSelection] = createSignal<ReadonlySet<string>>(new Set());
  const [activeKey, setActiveKey] = createSignal<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);

  // Initial sort only; the user's subsequent choice must win, so this is an untracked
  // seed rather than a derived value. Same lifetime argument as the descriptor above.
  /* eslint-disable solid/reactivity */
  const [sortColumn, setSortColumn] = createSignal(props.descriptor.defaultSort?.column ?? 'name');
  const [sortDirection, setSortDirection] = createSignal<SortDirection>(
    props.descriptor.defaultSort?.direction ?? 'asc'
  );
  /* eslint-enable solid/reactivity */

  const columns = createMemo(() => props.descriptor.columns.filter((c) => !c.optional));
  const showLoading = createDelayedLoading(() => list.status() === 'loading');

  /**
   * Filter, then sort.
   *
   * A single memo, so it recomputes only when the list, the query or the sort actually
   * change. The React equivalent recomputed on every render because its dependency
   * array contained an inline `['name']` literal, making the memo permanently invalid.
   */
  const visibleItems = createMemo(() => {
    const query = search().trim().toLowerCase();
    const all = list.items();

    const filtered = query
      ? all.filter((item) => {
          for (const column of props.descriptor.columns) {
            const value = column.value(item);
            if (
              value !== null &&
              value !== undefined &&
              String(value).toLowerCase().includes(query)
            ) {
              return true;
            }
          }
          const extra = props.descriptor.searchExtra?.(item) ?? [];
          return extra.some((value) => value?.toLowerCase().includes(query));
        })
      : all;

    const column = props.descriptor.columns.find((c) => c.id === sortColumn());
    if (!column) return filtered;

    const direction = sortDirection() === 'asc' ? 1 : -1;
    // `filtered` may be the store array itself, which must not be sorted in place.
    return [...filtered].sort(
      (a, b) => compareValues(column.value(a), column.value(b)) * direction
    );
  });

  const activeItem = createMemo(() => {
    const key = activeKey();
    return key ? (list.items().find((item) => resourceKey(item) === key) ?? null) : null;
  });

  const selectedItems = createMemo(() => {
    const keys = selection();
    return list.items().filter((item) => keys.has(resourceKey(item)));
  });

  const toggle = (key: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelection((prev) =>
      prev.size === visibleItems().length
        ? new Set<string>()
        : new Set(visibleItems().map(resourceKey))
    );
  };

  const sortBy = (columnId: string) => {
    batch(() => {
      if (sortColumn() === columnId) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(columnId);
        setSortDirection('asc');
      }
    });
  };

  const runDelete = async () => {
    const items = selectedItems();
    const cluster = selectedName();
    const remove = props.descriptor.api.remove;
    if (!cluster || !remove || items.length === 0) return;

    // Kubernetes deletes are per-namespace, so group before calling.
    const byNamespace = new Map<string | undefined, string[]>();
    for (const item of items) {
      const ns = item.metadata?.namespace;
      const names = byNamespace.get(ns) ?? [];
      names.push(item.metadata?.name ?? '');
      byNamespace.set(ns, names);
    }

    try {
      await Promise.all(
        [...byNamespace].map(([namespace, resourceNames]) =>
          remove({ name: cluster, namespace, resourceNames })
        )
      );
      toast.success(
        `Deleted ${items.length} ${props.descriptor.kind}${items.length === 1 ? '' : 's'}`
      );
      setSelection(new Set<string>());
      // No refetch: the watch delivers the DELETED events.
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setConfirmingDelete(false);
    }
  };

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] px-3 py-2">
        <h1 class="text-sm font-medium text-[var(--text-primary)]">{props.descriptor.title}</h1>
        <span class="tnum text-2xs text-[var(--text-tertiary)]">
          {visibleItems().length}
          <Show when={visibleItems().length !== list.items().length}>
            {` of ${list.items().length}`}
          </Show>
        </span>

        <div class="ml-auto flex items-center gap-2">
          <SearchInput
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            onClear={() => setSearch('')}
            placeholder={`Search ${props.descriptor.title.toLowerCase()}…`}
            class="w-56"
          />

          <Show when={selection().size > 0}>
            <span class="tnum text-2xs text-[var(--text-tertiary)]">
              {selection().size} selected
            </span>
            <For each={props.descriptor.actions?.filter((a) => a.multi)}>
              {(action) => (
                <Show when={action.available?.(selectedItems()) ?? true}>
                  <Button
                    size="sm"
                    variant={action.danger ? 'danger' : 'secondary'}
                    icon={action.icon}
                    onClick={() =>
                      void action
                        .run(selectedItems(), {
                          context: selectedName() ?? '',
                          refetch: list.refetch,
                        })
                        .catch((err: unknown) => toast.error(getErrorMessage(err)))
                    }
                  >
                    {action.label}
                  </Button>
                </Show>
              )}
            </For>
            <Show when={props.descriptor.api.remove}>
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            </Show>
          </Show>

          <IconButton icon={RefreshCw} label="Refresh" size="sm" onClick={list.refetch} />
        </div>
      </div>

      <Show
        when={list.status() !== 'error'}
        fallback={<ErrorState error={list.error()} onRetry={list.refetch} />}
      >
        <ResourceTable
          descriptor={props.descriptor}
          columns={columns()}
          items={visibleItems()}
          loading={showLoading()}
          selection={selection()}
          onToggle={toggle}
          onToggleAll={toggleAll}
          activeKey={activeKey()}
          onActivate={(item) => setActiveKey(resourceKey(item))}
          sortColumn={sortColumn()}
          sortDirection={sortDirection()}
          onSort={sortBy}
          empty={
            <EmptyState
              icon={search() ? undefined : FileCode2}
              title={
                search()
                  ? `No ${props.descriptor.title.toLowerCase()} match “${search()}”`
                  : `No ${props.descriptor.title.toLowerCase()}`
              }
              description={
                search()
                  ? 'Try a different search term.'
                  : props.descriptor.namespaced
                    ? 'Nothing in the selected namespaces.'
                    : undefined
              }
            />
          }
        />
      </Show>

      <Drawer
        open={activeItem() !== null}
        onClose={() => setActiveKey(null)}
        title={activeItem()?.metadata?.name ?? ''}
        storageKey={`kumate.drawer.${props.descriptor.id}`}
      >
        <Show when={activeItem()}>
          {(item) => <ResourceDetail descriptor={props.descriptor} item={item()} />}
        </Show>
      </Drawer>

      <ConfirmDialog
        open={confirmingDelete()}
        onOpenChange={setConfirmingDelete}
        variant="danger"
        title={`Delete ${selection().size} ${props.descriptor.kind}${selection().size === 1 ? '' : 's'}?`}
        description="This cannot be undone. The objects are removed from the cluster immediately."
        confirmLabel="Delete"
        onConfirm={runDelete}
      />
    </div>
  );
}
