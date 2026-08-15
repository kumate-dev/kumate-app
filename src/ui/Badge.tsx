/**
 * Small labelled chip.
 *
 * Every variant is a `--status-*-subtle` background under `--status-*` text. That pair
 * is the whole reason the tokens are defined together: the hue carries the meaning, so
 * a badge needs no icon, no border and no weight change to be read at a glance down a
 * column of two hundred rows.
 *
 * `variant` also accepts the legacy `BadgeVariant` strings (`success`, `warning`,
 * `error`, …) that the 30-odd `*Status.ts` helpers still return. Rather than rewriting
 * all of them up front, they are mapped here — a call site can move to the new names
 * whenever it is touched, and neither form breaks.
 */

import { splitProps, type JSX } from 'solid-js';

import { cn } from '@/lib/k8s';
import type { BadgeVariant } from '@/types/variant';

export type StatusVariant = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';

/** Either vocabulary. New code should use `StatusVariant`. */
export type AnyBadgeVariant = StatusVariant | BadgeVariant;

const LEGACY: Record<BadgeVariant, StatusVariant> = {
  default: 'neutral',
  success: 'ok',
  warning: 'warn',
  error: 'danger',
  secondary: 'neutral',
};

/** Normalises either vocabulary to the token-backed one. */
export const toStatusVariant = (variant: AnyBadgeVariant | undefined): StatusVariant => {
  if (variant === undefined) return 'neutral';
  return variant in LEGACY ? LEGACY[variant as BadgeVariant] : (variant as StatusVariant);
};

const VARIANT: Record<StatusVariant, string> = {
  ok: 'bg-[var(--status-ok-subtle)] text-[var(--status-ok)]',
  warn: 'bg-[var(--status-warn-subtle)] text-[var(--status-warn)]',
  danger: 'bg-[var(--status-danger-subtle)] text-[var(--status-danger)]',
  info: 'bg-[var(--status-info-subtle)] text-[var(--status-info)]',
  neutral: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--accent-subtle)] text-[var(--accent)]',
};

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-4 gap-1 px-1.5',
  md: 'h-5 gap-1.5 px-2',
};

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: AnyBadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, ['variant', 'size', 'class', 'children']);

  return (
    <span
      class={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-xs select-none',
        'text-2xs font-medium whitespace-nowrap',
        VARIANT[toStatusVariant(local.variant)],
        SIZE[local.size ?? 'md'],
        local.class
      )}
      {...others}
    >
      {local.children}
    </span>
  );
}
