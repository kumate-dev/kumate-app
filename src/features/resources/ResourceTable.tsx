import { createMemo, For, Show, type JSX } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { ChevronDown, ChevronUp } from 'lucide-solid';
import { cn, resourceKey, type K8sObject } from '@/lib/k8s';
import { Checkbox } from '@/ui/Checkbox';
import { SkeletonRows } from '@/ui/Skeleton';
import type { ColumnDef, ResourceDescriptor, SortDirection } from './types';

/** Matches `--spacing-row` in index.css. Must stay in sync — the virtualizer needs a number. */
const ROW_HEIGHT = 28;

/**
 * Render the rows above and below the viewport so fast scrolling does not show gaps.
 * 8 is enough at 28px rows without materially increasing DOM size.
 */
const OVERSCAN = 8;

export interface ResourceTableProps<T extends K8sObject> {
  descriptor: ResourceDescriptor<T>;
  columns: ColumnDef<T>[];
  items: readonly T[];
  loading: boolean;
  /** Selected row keys (`namespace/name`), never object references. */
  selection: ReadonlySet<string>;
  onToggle: (key: string, item: T) => void;
  onToggleAll: () => void;
  activeKey: string | null;
  onActivate: (item: T) => void;
  sortColumn: string;
  sortDirection: SortDirection;
  onSort: (columnId: string) => void;
  empty: JSX.Element;
}

/**
 * The one table used by every resource kind.
 *
 * ## Virtualization
 *
 * The React version mapped the entire filtered list into rows: a 5,000-pod cluster
 * produced 5,000 rows of ~7 cells each. Here only the visible window exists in the
 * DOM, so the row count stops mattering.
 *
 * It is a CSS grid rather than a `<table>`, because virtualized rows must be
 * absolutely positioned and `<tr>` cannot be. `role` attributes restore the semantics
 * a real table would have given us for free.
 *
 * ## Selection
 *
 * Keyed by `namespace/name`. The previous implementation used
 * `selectedItems.includes(item)` — object identity — and every `MODIFIED` watch event
 * produces a new object, so selected rows silently deselected themselves whenever the
 * cluster touched them. It was also O(n·m), evaluated inside the row loop; a `Set`
 * lookup is O(1).
 */
export function ResourceTable<T extends K8sObject>(props: ResourceTableProps<T>) {
  let scrollRef!: HTMLDivElement;

  const gridTemplate = createMemo(() => `28px ${props.columns.map((c) => c.width).join(' ')}`);

  const virtualizer = createVirtualizer({
    // Getters, not values: the virtualizer must see the current count reactively.
    get count() {
      return props.items.length;
    },
    getScrollElement: () => scrollRef,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const allSelected = createMemo(
    () => props.items.length > 0 && props.selection.size === props.items.length
  );

  const someSelected = createMemo(
    () => props.selection.size > 0 && props.selection.size < props.items.length
  );

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      {/* Header sits outside the scroll container so it stays put without `sticky`,
          which interacts badly with an absolutely-positioned virtual list. */}
      <div
        role="row"
        class="text-2xs grid shrink-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--surface-base)] px-3 font-medium tracking-wide text-[var(--text-tertiary)] uppercase"
        style={{ 'grid-template-columns': gridTemplate(), height: `${ROW_HEIGHT}px` }}
      >
        <Checkbox
          checked={allSelected()}
          indeterminate={someSelected()}
          onChange={() => props.onToggleAll()}
          aria-label="Select all rows"
        />

        <For each={props.columns}>
          {(column) => (
            <Show
              when={column.sortable !== false}
              fallback={
                <div
                  role="columnheader"
                  class={cn('truncate', column.align === 'right' && 'text-right')}
                >
                  {column.header}
                </div>
              }
            >
              <button
                role="columnheader"
                type="button"
                onClick={() => props.onSort(column.id)}
                aria-sort={
                  props.sortColumn === column.id
                    ? props.sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                class={cn(
                  'flex items-center gap-1 truncate uppercase transition-colors hover:text-[var(--text-secondary)]',
                  column.align === 'right' && 'justify-end',
                  props.sortColumn === column.id && 'text-[var(--text-secondary)]'
                )}
              >
                <span class="truncate">{column.header}</span>
                <Show when={props.sortColumn === column.id}>
                  {props.sortDirection === 'asc' ? (
                    <ChevronUp size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                </Show>
              </button>
            </Show>
          )}
        </For>
      </div>

      <div ref={scrollRef} class="min-h-0 flex-1 overflow-auto" role="rowgroup">
        <Show
          when={!props.loading}
          fallback={
            <div class="px-3 pt-1">
              <SkeletonRows count={14} columns={props.columns.map(() => 1)} />
            </div>
          }
        >
          <Show when={props.items.length > 0} fallback={props.empty}>
            <div class="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              <For each={virtualizer.getVirtualItems()}>
                {(virtualRow) => {
                  // Read through the index so the row re-reads from the store: the
                  // list is reconciled in place, so `items[i]` stays the same object
                  // and only the changed leaves update.
                  const item = () => props.items[virtualRow.index];
                  const key = () => {
                    const value = item();
                    return value ? resourceKey(value) : '';
                  };

                  return (
                    <Show when={item()}>
                      {(row) => (
                        <div
                          role="row"
                          tabindex={0}
                          aria-selected={props.activeKey === key()}
                          onClick={() => props.onActivate(row())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              props.onActivate(row());
                            }
                          }}
                          class={cn(
                            'absolute top-0 left-0 grid w-full cursor-default items-center gap-3 border-b border-[var(--border-subtle)] px-3 text-[var(--text-secondary)]',
                            'hover:bg-[var(--surface-hover)]',
                            props.activeKey === key() &&
                              'bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                          )}
                          style={{
                            height: `${ROW_HEIGHT}px`,
                            'grid-template-columns': gridTemplate(),
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {/* The stop-propagation lives on a wrapper, not on the
                              Checkbox: `CheckboxProps` is a closed prop set with no
                              `onClick`, and selecting a row must not also open the
                              detail drawer. */}
                          <span onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={props.selection.has(key())}
                              onChange={() => props.onToggle(key(), row())}
                              aria-label={`Select ${row().metadata?.name ?? 'row'}`}
                            />
                          </span>

                          <For each={props.columns}>
                            {(column) => (
                              <div
                                role="cell"
                                class={cn(
                                  'truncate',
                                  column.align === 'right' && 'tnum text-right',
                                  column.class
                                )}
                              >
                                {column.cell
                                  ? column.cell(row())
                                  : String(column.value(row()) ?? '—')}
                              </div>
                            )}
                          </For>
                        </div>
                      )}
                    </Show>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
