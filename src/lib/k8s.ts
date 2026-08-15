import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** The minimum shape every Kubernetes object we handle satisfies. */
export interface K8sObject {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    uid?: string;
    creationTimestamp?: Date | string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
}

/**
 * The identity of a Kubernetes object within a list.
 *
 * `namespace/name` — deliberately NOT `uid`, and emphatically not object identity.
 *
 * The previous implementation compared rows with `selectedItems.includes(item)`,
 * i.e. reference equality. Every `MODIFIED` watch event produces a fresh object, so
 * a selected row silently deselected itself the moment the cluster touched it. Use
 * this function anywhere a row needs to be identified across an update.
 */
export const resourceKey = (item: K8sObject): string =>
  `${item.metadata?.namespace ?? ''}/${item.metadata?.name ?? ''}`;

export const resourceName = (item: K8sObject): string => item.metadata?.name ?? '';

export const resourceNamespace = (item: K8sObject): string | undefined => item.metadata?.namespace;

/** Read a possibly-nested path off an object without `any`. */
export const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);

/**
 * Compact age string, `kubectl`-style: `12d`, `3h`, `45m`, `20s`.
 *
 * Pure and cheap on purpose. It is called for every visible row on every tick of the
 * single shared clock (see `stores/clock.ts`) — there is no per-row timer.
 */
export const formatAge = (timestamp: Date | string | undefined, now: number): string => {
  if (!timestamp) return '—';
  const then = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours < 10 ? `${hours}h${minutes % 60}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 365) return days < 10 ? `${days}d${hours % 24}h` : `${days}d`;

  return `${Math.floor(days / 365)}y${days % 365}d`;
};

/**
 * Multipliers for every suffix `resource.Quantity` accepts.
 *
 * Binary and decimal are genuinely different (`1Mi` is 1048576, `1M` is 1000000) and the
 * two are freely mixed within a single object — a PVC asks for `10Gi` and a provisioner
 * may report `status.capacity` as `10737418240` — so both have to be understood before
 * two quantities can be compared at all.
 */
const QUANTITY_SUFFIX: Record<string, number> = {
  '': 1,
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
};

const QUANTITY = /^(-?(?:\d+\.?\d*|\.\d+))(?:[eE]([-+]?\d+))?([a-zA-Z]{0,2})$/;

/**
 * `resource.Quantity` as a number, or `undefined` when it is not one.
 *
 * Lives here because it is the only honest way to *sort* or *compare* a quantity:
 * `10Gi` sorts before `9Gi` as text, and `1000m` is not less than `2`. Callers sort on
 * the number and render the original string, which is what the apiserver sent and what
 * the user wrote.
 */
export const parseQuantity = (raw?: string): number | undefined => {
  if (raw === undefined) return undefined;

  const match = QUANTITY.exec(raw.trim());
  const digits = match?.[1];
  if (digits === undefined) return undefined;

  const mantissa = Number(digits);
  if (Number.isNaN(mantissa)) return undefined;

  const scale = QUANTITY_SUFFIX[match?.[3] ?? ''];
  if (scale === undefined) return undefined;

  const exponent = match?.[2] === undefined ? 0 : Number(match[2]);
  return mantissa * 10 ** exponent * scale;
};

/** Sort comparator that puts empty values last regardless of direction. */
export const compareValues = (a: unknown, b: unknown): number => {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const as = String(a);
  const bs = String(b);
  // `numeric` so `pod-2` sorts before `pod-10`, which is what people expect from
  // generated workload names.
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
};
