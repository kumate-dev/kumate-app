/**
 * Loading placeholders.
 *
 * The pulse is `.animate-skeleton` from `index.css` — one shared keyframe, which is
 * what replaced `framer-motion` (~120 KB of animation runtime imported for a single
 * oscillating opacity). It already honours `prefers-reduced-motion`, so a monitoring
 * tool left open on a wall display does not strobe.
 *
 * `SkeletonRows` matches the real table's geometry: rows are `--spacing-row` tall and
 * the bars follow a column weighting, so the skeleton occupies exactly the space the
 * data will, and the page does not jump when the first watch event lands.
 */

import { For, Index, splitProps, type JSX } from 'solid-js';

import { cn } from '@/lib/k8s';

export interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
}

const dimension = (value: number | string | undefined): string | undefined =>
  value === undefined ? undefined : typeof value === 'number' ? `${value}px` : value;

export function Skeleton(props: SkeletonProps) {
  const [local, others] = splitProps(props, ['width', 'height', 'class', 'style']);

  return (
    <div
      aria-hidden="true"
      class={cn('animate-skeleton rounded-xs bg-[var(--text-tertiary)]', local.class)}
      style={{
        width: dimension(local.width),
        height: dimension(local.height) ?? '0.75rem',
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...others}
    />
  );
}

export interface SkeletonRowsProps {
  /** Number of placeholder rows. Defaults to 12. */
  count?: number;
  /**
   * Relative widths of the bars in each row, as flex weights. Defaults to a shape that
   * reads like name / namespace / status / age.
   */
  columns?: number[];
  class?: string;
}

const DEFAULT_COLUMNS = [6, 3, 2, 2, 1];

export function SkeletonRows(props: SkeletonRowsProps) {
  const [local] = splitProps(props, ['count', 'columns', 'class']);

  const columns = () => local.columns ?? DEFAULT_COLUMNS;

  return (
    <div class={cn('flex flex-col', local.class)} aria-hidden="true">
      {/* `Index` rather than `For`: the rows are positional and carry no identity, so
          there is no key to be stable about. */}
      <Index each={Array.from({ length: local.count ?? 12 })}>
        {(_row, rowIndex) => (
          <div class="flex h-[var(--spacing-row)] shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] px-3">
            <For each={columns()}>
              {(weight) => (
                <div style={{ flex: `${weight} 1 0%` }}>
                  {/* A small stagger stops the whole table pulsing in lockstep, which
                      reads as a flashing screen rather than as loading. */}
                  <Skeleton
                    class="w-full"
                    style={{ 'animation-delay': `${(rowIndex % 6) * 90}ms` }}
                  />
                </div>
              )}
            </For>
          </div>
        )}
      </Index>
    </div>
  );
}
