/**
 * Square, icon-only button.
 *
 * `label` is required and does double duty: it is the `aria-label` (an icon-only
 * button is otherwise anonymous to a screen reader) and the tooltip text (it is
 * otherwise anonymous to everyone else). Making it one prop means the two cannot
 * drift apart.
 *
 * `tooltip={false}` skips the Kobalte tooltip machinery entirely rather than merely
 * disabling it — this component is used per table row, and a tooltip root allocates
 * signals and a presence tracker each. The `aria-label` stays either way.
 */

import { Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { cn } from '@/lib/k8s';

import { Button, type ButtonProps } from './Button';
import { Tooltip } from './Tooltip';
import type { IconComponent, Placement } from './types';

export interface IconButtonProps
  extends Omit<ButtonProps, 'size' | 'icon' | 'iconRight' | 'children'> {
  icon: IconComponent;
  /** Accessible name, also used as the tooltip body. Required on purpose. */
  label: string;
  size?: 'sm' | 'md';
  /** Set false in dense, repeated contexts where a tooltip would be noise. */
  tooltip?: boolean;
  tooltipPlacement?: Placement;
}

const SIZE: Record<'sm' | 'md', { box: string; glyph: number }> = {
  sm: { box: 'h-6 w-6', glyph: 13 },
  md: { box: 'h-[var(--spacing-row)] w-[var(--spacing-row)]', glyph: 15 },
};

export function IconButton(props: IconButtonProps) {
  const [local, others] = splitProps(props, [
    'icon',
    'label',
    'size',
    'tooltip',
    'tooltipPlacement',
    'class',
    'variant',
  ]);

  const metrics = () => SIZE[local.size ?? 'md'];

  const button = () => (
    <Button
      variant={local.variant ?? 'ghost'}
      size="icon"
      aria-label={local.label}
      class={cn(metrics().box, local.class)}
      {...others}
    >
      <Dynamic component={local.icon} size={metrics().glyph} />
    </Button>
  );

  return (
    <Show when={local.tooltip !== false} fallback={button()}>
      <Tooltip content={local.label} placement={local.tooltipPlacement}>
        {button()}
      </Tooltip>
    </Show>
  );
}
