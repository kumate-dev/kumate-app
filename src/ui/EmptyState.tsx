/**
 * "There is nothing here" — an empty namespace, a filter that matched nothing, a
 * cluster with no CRDs.
 *
 * Kept quiet on purpose. An empty pod list is the *normal* state of a fresh namespace,
 * not a problem, so this uses tertiary text and a hairline glyph frame rather than the
 * status hues, which are reserved for things that are actually wrong. Compare
 * `ErrorState`, which is the same layout tuned the other way.
 */

import { Show, children, splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { cn } from '@/lib/k8s';

import type { IconComponent } from './types';

export interface EmptyStateProps {
  icon?: IconComponent;
  title: string;
  description?: JSX.Element;
  /** Usually a single `Button`. */
  action?: JSX.Element;
  class?: string;
}

export function EmptyState(props: EmptyStateProps) {
  const [local] = splitProps(props, ['icon', 'title', 'description', 'action', 'class']);

  // Memoised so the `<Show>` condition and the render do not each build the node.
  const description = children(() => local.description);
  const action = children(() => local.action);

  return (
    <div
      class={cn(
        'flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-1.5',
        'px-6 py-10 text-center',
        local.class
      )}
    >
      <Show when={local.icon}>
        {(icon) => (
          <div
            class={cn(
              'mb-1.5 flex size-9 items-center justify-center rounded-sm border',
              'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]'
            )}
            aria-hidden="true"
          >
            <Dynamic component={icon()} size={17} />
          </div>
        )}
      </Show>

      <p class="font-medium text-[var(--text-primary)]">{local.title}</p>

      <Show when={description()}>
        <p class="text-2xs max-w-[380px] leading-relaxed text-[var(--text-tertiary)]">
          {description()}
        </p>
      </Show>

      <Show when={action()}>
        <div class="mt-3">{action()}</div>
      </Show>
    </div>
  );
}
