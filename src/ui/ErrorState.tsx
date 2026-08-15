/**
 * The failure panel for a resource view.
 *
 * It branches on the *typed* error from `src/utils/error.ts`, never on message text —
 * matching on prose is what the `AppError` contract exists to replace.
 *
 * Three shapes, in priority order:
 *
 * 1. `isDisconnected` — the user disconnected this cluster. That is an action they took,
 *    not a fault, so it renders calm and informational (info hue, plug glyph, no alert
 *    role) with a Reconnect action. Painting it red trains people to ignore red.
 * 2. `isForbidden` — RBAC said no. Warn hue, and no Retry: the identical call will fail
 *    the identical way, and offering the button just invites people to press it.
 * 3. Everything else — danger hue, `role="alert"`, and a Retry button **only** when
 *    `isRetryable` says the same call could plausibly succeed.
 *
 * The body text is always `getErrorHint`, which turns the common kinds into an
 * instruction ("Check your network or VPN") and falls through to the raw message
 * otherwise.
 */

import { Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Lock, Plug, RefreshCw, TriangleAlert } from 'lucide-solid';

import { cn } from '@/lib/k8s';
import { getErrorHint, isDisconnected, isForbidden, isRetryable } from '@/utils/error';

import { Button } from './Button';
import type { IconComponent } from './types';

type Tone = 'info' | 'warn' | 'danger';

const TONE: Record<Tone, string> = {
  info: 'bg-[var(--status-info-subtle)] text-[var(--status-info)]',
  warn: 'bg-[var(--status-warn-subtle)] text-[var(--status-warn)]',
  danger: 'bg-[var(--status-danger-subtle)] text-[var(--status-danger)]',
};

export interface ErrorStateProps {
  error: unknown;
  /** Shown as the Retry action when the error is retryable. */
  onRetry?: () => void;
  /** Shown as the Reconnect action when the cluster is disconnected. */
  onReconnect?: () => void;
  /** Overrides the derived heading. */
  title?: string;
  class?: string;
}

export function ErrorState(props: ErrorStateProps) {
  const [local] = splitProps(props, ['error', 'onRetry', 'onReconnect', 'title', 'class']);

  const disconnected = () => isDisconnected(local.error);
  const forbidden = () => !disconnected() && isForbidden(local.error);

  const tone = (): Tone => (disconnected() ? 'info' : forbidden() ? 'warn' : 'danger');

  const icon = (): IconComponent => (disconnected() ? Plug : forbidden() ? Lock : TriangleAlert);

  const heading = () =>
    local.title ??
    (disconnected()
      ? 'Cluster disconnected'
      : forbidden()
        ? 'Not permitted'
        : 'Could not load this resource');

  const showReconnect = () => disconnected() && local.onReconnect !== undefined;
  const showRetry = () =>
    !disconnected() && isRetryable(local.error) && local.onRetry !== undefined;

  return (
    <div
      role={disconnected() ? 'status' : 'alert'}
      class={cn(
        'flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-1.5',
        'px-6 py-10 text-center',
        local.class
      )}
    >
      <div
        class={cn('mb-1.5 flex size-9 items-center justify-center rounded-sm', TONE[tone()])}
        aria-hidden="true"
      >
        <Dynamic component={icon()} size={17} />
      </div>

      <p class="font-medium text-[var(--text-primary)]">{heading()}</p>

      <p class="text-2xs max-w-[420px] leading-relaxed text-[var(--text-secondary)]">
        {getErrorHint(local.error)}
      </p>

      <Show when={showReconnect()}>
        <div class="mt-3">
          <Button variant="primary" icon={Plug} onClick={() => local.onReconnect?.()}>
            Reconnect
          </Button>
        </div>
      </Show>

      <Show when={showRetry()}>
        <div class="mt-3">
          <Button variant="secondary" icon={RefreshCw} onClick={() => local.onRetry?.()}>
            Retry
          </Button>
        </div>
      </Show>
    </div>
  );
}
