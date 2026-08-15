/**
 * A `Badge` for a Kubernetes status string, shaped to take the `{ status, variant }`
 * pairs the `*Status.ts` helpers already return.
 *
 * Two things Kubernetes forces on us:
 *
 * - Status strings are long and unbounded (`CreateContainerConfigError`,
 *   `ImagePullBackOff`, and CRDs can invent worse). The chip truncates to a fixed width
 *   so the column never reflows as pods churn, and the full value is available on hover.
 *
 * - The tooltip is mounted **only** when the value is long enough to actually be cut
 *   off. This is a table cell rendered thousands of times; a Kobalte tooltip root costs
 *   several signals and a presence tracker each, and paying that for `Running` — which
 *   fits — would be the single most expensive thing on the page.
 *
 * The leading dot uses `currentColor`, so it is the status hue by construction and can
 * never drift from the text beside it.
 */

import { Show, splitProps } from 'solid-js';

import { cn } from '@/lib/k8s';

import { Badge, type AnyBadgeVariant } from './Badge';
import { Tooltip } from './Tooltip';

export interface StatusBadgeProps {
  status: string;
  variant?: AnyBadgeVariant;
  size?: 'sm' | 'md';
  /** Truncation width in pixels. Defaults to 132. */
  maxWidth?: number;
  /**
   * Character count above which the tooltip is mounted. Defaults to 16, which is about
   * what fits in the default width at 11px.
   */
  tooltipAfter?: number;
  class?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  const [local] = splitProps(props, [
    'status',
    'variant',
    'size',
    'maxWidth',
    'tooltipAfter',
    'class',
  ]);

  const mayOverflow = () => local.status.length > (local.tooltipAfter ?? 16);

  const badge = () => (
    <Badge variant={local.variant} size={local.size} class={local.class}>
      <span
        class={cn(
          'size-1.5 shrink-0 rounded-full bg-current',
          // The dot is the same hue as the text, so it needs to be slightly lighter to
          // avoid reading as a second glyph.
          'opacity-80'
        )}
        aria-hidden="true"
      />
      <span class="truncate" style={{ 'max-width': `${local.maxWidth ?? 132}px` }}>
        {local.status}
      </span>
    </Badge>
  );

  return (
    <Show when={mayOverflow()} fallback={badge()}>
      <Tooltip content={local.status}>{badge()}</Tooltip>
    </Show>
  );
}
