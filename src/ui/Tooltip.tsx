/**
 * Small, dense tooltip.
 *
 * Two non-obvious decisions:
 *
 * 1. The trigger is rendered as a `<span>` wrapper rather than Kobalte's default
 *    `<button>`. Almost every tooltip in this app wraps something that is *already*
 *    interactive (an IconButton, a truncated status cell), and nesting a button inside
 *    a button is invalid HTML and breaks keyboard activation.
 *
 * 2. Because a `<span>` never receives focus, Kobalte's own focus handling — which
 *    listens for the non-bubbling `focus` event on the trigger element itself — cannot
 *    fire. So the open state is controlled here and additionally driven by `focusin` /
 *    `focusout`, which *do* bubble up from the real control inside. Without this,
 *    tooltips would be mouse-only, and every icon-only button in the app would be
 *    unlabelled for keyboard users.
 *
 * 400ms open delay: long enough that sweeping the pointer across a toolbar stays quiet,
 * short enough to feel deliberate. Kobalte's global warm-up means the second tooltip in
 * a row opens immediately.
 */

import { createSignal, splitProps, type JSX } from 'solid-js';
import { Tooltip as KTooltip } from '@kobalte/core/tooltip';

import { cn } from '@/lib/k8s';

import type { Placement } from './types';

export interface TooltipProps {
  /** Tooltip body. Keep it to a phrase; this is not a popover. */
  content: JSX.Element;
  /** The element the tooltip describes. Rendered inside an inline-flex wrapper. */
  children: JSX.Element;
  placement?: Placement;
  /** Milliseconds before opening on hover. Defaults to 400. */
  openDelay?: number;
  closeDelay?: number;
  /** Suppresses the tooltip without changing the tree. */
  disabled?: boolean;
  /** Class for the floating panel. */
  class?: string;
  /** Class for the inline wrapper around `children`. */
  triggerClass?: string;
}

export function Tooltip(props: TooltipProps) {
  const [local] = splitProps(props, [
    'content',
    'children',
    'placement',
    'openDelay',
    'closeDelay',
    'disabled',
    'class',
    'triggerClass',
  ]);

  const [open, setOpen] = createSignal(false);

  const show = () => {
    if (!local.disabled) setOpen(true);
  };

  return (
    <KTooltip
      open={open()}
      onOpenChange={setOpen}
      disabled={local.disabled}
      placement={local.placement ?? 'top'}
      gutter={6}
      openDelay={local.openDelay ?? 400}
      closeDelay={local.closeDelay ?? 100}
    >
      <KTooltip.Trigger
        as="span"
        class={cn('inline-flex max-w-full items-center', local.triggerClass)}
        onFocusIn={show}
        onFocusOut={() => setOpen(false)}
      >
        {local.children}
      </KTooltip.Trigger>
      <KTooltip.Portal>
        <KTooltip.Content
          class={cn(
            'animate-in z-50 max-w-[280px] rounded-sm border border-[var(--border-default)]',
            'text-2xs bg-[var(--surface-overlay)] px-2 py-1 leading-snug',
            'text-[var(--text-primary)] shadow-[var(--shadow-overlay)]',
            local.class
          )}
        >
          {local.content}
        </KTooltip.Content>
      </KTooltip.Portal>
    </KTooltip>
  );
}
