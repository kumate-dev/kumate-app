/**
 * The one button.
 *
 * Renders a real `<button>` and forwards every native attribute, so `form`, `onClick`,
 * `title`, `data-*` and `ref` all behave. Nothing here wraps or swallows the element:
 * a component that hides the DOM node is unusable the first time you need `type="submit"`.
 *
 * Heights come from `--spacing-row` (28px) so a button dropped into a table toolbar
 * lines up with the rows behind it. Every colour is a token; `danger` and `primary`
 * both use `--text-inverted` on a saturated fill, which is what makes them read as
 * "filled" in dark *and* light without a per-theme override.
 *
 * `loading` implies `disabled` and swaps the leading icon for a Spinner, so the label
 * never shifts. Hover styles are gated behind `enabled:` rather than killing pointer
 * events, so a disabled button can still be the trigger for a tooltip explaining why.
 */

import { Show, splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { cn } from '@/lib/k8s';

import { Spinner } from './Spinner';
import type { IconComponent } from './types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'icon';

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 ' +
  'whitespace-nowrap rounded-sm border font-medium transition-colors duration-75 ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-[var(--accent)] text-[var(--text-inverted)] ' +
    'enabled:hover:bg-[var(--accent-hover)]',
  secondary:
    'border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)] ' +
    'enabled:hover:bg-[var(--surface-hover)] enabled:active:bg-[var(--surface-active)]',
  ghost:
    'border-transparent bg-transparent text-[var(--text-secondary)] ' +
    'enabled:hover:bg-[var(--surface-hover)] enabled:hover:text-[var(--text-primary)]',
  subtle:
    'border-transparent bg-[var(--surface-inset)] text-[var(--text-secondary)] ' +
    'enabled:hover:bg-[var(--surface-hover)] enabled:hover:text-[var(--text-primary)]',
  // No `--status-danger-hover` token exists, and inventing one would put a sixth red in
  // the palette. A brightness filter keeps the hue exactly on token in both themes.
  danger:
    'border-transparent bg-[var(--status-danger)] text-[var(--text-inverted)] ' +
    'enabled:hover:brightness-110 enabled:active:brightness-95',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-6 gap-1 px-2 text-2xs',
  md: 'h-[var(--spacing-row)] px-2.5',
  icon: 'h-[var(--spacing-row)] w-[var(--spacing-row)] p-0',
};

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and replaces `icon` with a spinner. */
  loading?: boolean;
  icon?: IconComponent;
  iconRight?: IconComponent;
}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'icon',
    'iconRight',
    'class',
    'children',
    'disabled',
    'type',
  ]);

  const variant = (): ButtonVariant => local.variant ?? 'secondary';
  const size = (): ButtonSize => local.size ?? 'md';
  const glyph = () => (size() === 'sm' ? 12 : 14);

  // While loading the spinner takes the leading slot, so the label does not move.
  const leading = () => (local.loading ? undefined : local.icon);

  return (
    <button
      // Buttons inside a <form> default to `submit`, which has reloaded more than one
      // desktop app. Opt in explicitly instead.
      type={local.type ?? 'button'}
      disabled={local.disabled || local.loading}
      aria-busy={local.loading ? 'true' : undefined}
      class={cn(BASE, VARIANT[variant()], SIZE[size()], local.class)}
      {...others}
    >
      <Show when={local.loading}>
        <Spinner size={glyph()} />
      </Show>
      <Show when={leading()}>
        {(icon) => <Dynamic component={icon()} size={glyph()} class="shrink-0" />}
      </Show>
      {local.children}
      <Show when={local.iconRight}>
        {(icon) => <Dynamic component={icon()} size={glyph()} class="shrink-0 opacity-70" />}
      </Show>
    </button>
  );
}
