import type { JSX } from 'solid-js';
import type { ListFn, WatchFn } from '@/lib/createResourceList';
import type { K8sObject } from '@/lib/k8s';
import type { K8sStatus } from '@/types/k8sStatus';
import type { IconComponent } from '@/ui/types';

/**
 * A resource *descriptor* is the entire per-kind definition of a screen.
 *
 * ## Why this exists
 *
 * The React codebase had three near-identical files per kind — `pages/X.tsx`,
 * `components/PaneX.tsx`, `components/SidebarX.tsx` — 114 files and roughly 14,700
 * lines. `diff pages/Roles.tsx pages/ClusterRoles.tsx` differed in ~40 of 96 lines;
 * everything else varied only by type parameter and API function name. Any fix to
 * table behaviour had to be applied 37 times, and in practice was not.
 *
 * A descriptor is *data*: columns, how to derive status, which detail sections to
 * show, which actions are available. One `ResourceView` renders all of them. Adding
 * a kind is ~60 lines of configuration instead of ~400 lines of duplicated component.
 *
 * The rule that keeps this honest: **if a kind needs behaviour the descriptor cannot
 * express, extend the descriptor type — do not fork the view.** The moment there are
 * two views, the duplication is back.
 */
export interface ResourceDescriptor<T extends K8sObject> {
  /** Stable id; also the route segment. */
  id: string;
  /** Kubernetes kind, e.g. `Pod`. */
  kind: string;
  /** Plural label shown in the sidebar and page title, e.g. `Pods`. */
  title: string;
  /** Navigation group this kind belongs to. */
  group: NavGroup;
  icon: IconComponent;
  /** Cluster-scoped kinds hide the namespace column and the namespace filter. */
  namespaced: boolean;

  api: ResourceApi<T>;
  columns: ColumnDef<T>[];

  /**
   * Default sort. Omit for `name` ascending — which is what almost every kind wants,
   * and what the old code re-implemented per page.
   */
  defaultSort?: { column: string; direction: SortDirection };

  /**
   * Extra text a search should match, beyond the visible column values.
   * Labels are the common case.
   */
  searchExtra?: (item: T) => (string | undefined)[];

  /** Derives the badge shown in the status column and the detail header. */
  status?: (item: T) => K8sStatus;

  /** Sections of the detail drawer, in order. */
  detail?: DetailSection<T>[];

  /**
   * Extra tabs in the detail panel, after the built-in Overview / YAML / Events.
   *
   * Exists so Pods can add Logs and Terminal without `ResourceDetail` importing
   * `V1Pod` and branching on the kind — the moment the panel special-cases one kind it
   * starts special-casing all of them. Panels are mounted only while their tab is
   * selected, so a tab that opens a stream costs nothing until it is opened.
   */
  extraTabs?: DetailTab<T>[];

  /** Row and selection actions, beyond the built-in delete/edit YAML. */
  actions?: ResourceAction<T>[];

  /** YAML skeleton offered by the "Create" button. */
  template?: () => string;
}

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<T> {
  id: string;
  header: string;
  /**
   * CSS grid track for this column, e.g. `'minmax(180px, 2fr)'` or `'80px'`.
   * The table is a CSS grid rather than a `<table>` so that virtualized rows can be
   * absolutely positioned while columns stay aligned.
   */
  width: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  /**
   * The sortable/searchable value. Keep it cheap — it is called per visible row per
   * sort, and for every row when searching.
   */
  value: (item: T) => unknown;
  /** Custom rendering. Defaults to the stringified `value`. */
  cell?: (item: T) => JSX.Element;
  /** Hidden by default but offered in the column picker. */
  optional?: boolean;
  class?: string;
}

export interface DetailSection<T> {
  id: string;
  title: string;
  /** Return `null` to omit the section for this object. */
  render: (item: T) => JSX.Element | null;
  /** Start collapsed. Use for long, rarely-read sections. */
  collapsed?: boolean;
}

export interface DetailTab<T> {
  /** Stable id, used as the tab value. Must not collide with `overview`/`yaml`/`events`. */
  id: string;
  label: string;
  render: (item: T) => JSX.Element;
}

export interface ActionContext {
  context: string;
  refetch: () => void;
}

export interface ResourceAction<T> {
  id: string;
  label: string;
  icon?: IconComponent;
  danger?: boolean;
  /** Hide entirely when false. */
  available?: (items: T[]) => boolean;
  /** Show but disabled, with this reason as a tooltip. */
  disabledReason?: (items: T[]) => string | null;
  /** Supports acting on a multi-row selection. */
  multi?: boolean;
  run: (items: T[], ctx: ActionContext) => Promise<void>;
}

export interface ResourceApi<T> {
  list: ListFn<T>;
  watch?: WatchFn<T>;
  remove?: (params: {
    name: string;
    namespace?: string;
    resourceNames: string[];
  }) => Promise<unknown>;
  create?: (params: { name: string; namespace?: string; manifest: T }) => Promise<unknown>;
  update?: (params: { name: string; namespace?: string; manifest: T }) => Promise<unknown>;

  /**
   * Apply a JSON merge patch to a single object.
   *
   * Prefer this over `update` for editing one field. `update` is `Api::replace`: it
   * sends the whole object — including `managedFields`, which the watch layer strips
   * before we ever see it — and overwrites concurrent changes to parts of the object
   * the user never looked at. A merge patch touches only the paths it names, and
   * setting a map entry to `null` removes it, so add / edit / delete of one key are
   * the same operation.
   */
  patch?: (params: {
    name: string;
    namespace?: string;
    resourceName: string;
    patch: Record<string, unknown>;
  }) => Promise<unknown>;
}

export type NavGroup =
  | 'overview'
  | 'workloads'
  | 'config'
  | 'network'
  | 'storage'
  | 'access'
  | 'cluster'
  | 'helm';

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'workloads', label: 'Workloads' },
  { id: 'config', label: 'Configuration' },
  { id: 'network', label: 'Network' },
  { id: 'storage', label: 'Storage' },
  { id: 'access', label: 'Access Control' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'helm', label: 'Helm' },
];

/**
 * Helper that preserves the element type through the descriptor.
 *
 * Without it every descriptor would need an explicit type argument, and a mismatch
 * between `api.list`'s element type and the `columns` accessors would go unnoticed.
 */
export const defineResource = <T extends K8sObject>(
  descriptor: ResourceDescriptor<T>
): ResourceDescriptor<T> => descriptor;
