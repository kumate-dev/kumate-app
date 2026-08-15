/**
 * Toasts.
 *
 * The public surface is deliberately identical to what `sonner` offered — `toast.success(msg)`,
 * `toast.error(msg)` — because ~50 call sites use exactly that and none of them should
 * have to care that the implementation underneath is `solid-toast`.
 *
 * Every toast is dispatched as `solid-toast`'s `custom` type. That bypasses its built-in
 * `ToastBar`, which ships its own colours and a bundled checkmark animation, and lets the
 * body be a plain token-styled element instead. The cost is that the enter/exit
 * transition is ours to draw: `model.visible` flips on dismissal and the element stays
 * mounted for `unmountDelay`, which is what the opacity/translate transition rides on.
 *
 * Status is a 2px hue bar plus a glyph — no coloured background, so a stack of four
 * toasts over a dark cluster view stays legible.
 *
 * Note: `disconnected` errors must not come through here at all. Disconnecting is a user
 * action, and toasting it turns a deliberate click into what looks like a fault. Branch
 * with `isDisconnected` before calling `toast.error`.
 */

import { Show, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  Toaster as SolidToaster,
  toast as solidToast,
  type Toast as ToastModel,
  type ToastOptions,
  type ToastPosition,
} from 'solid-toast';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-solid';

import { cn } from '@/lib/k8s';

import { Spinner } from './Spinner';
import type { IconComponent } from './types';

type ToastKind = 'success' | 'error' | 'info' | 'loading';

const BAR: Record<ToastKind, string> = {
  success: 'bg-[var(--status-ok)]',
  error: 'bg-[var(--status-danger)]',
  info: 'bg-[var(--status-info)]',
  loading: 'bg-[var(--accent)]',
};

const GLYPH: Record<ToastKind, string> = {
  success: 'text-[var(--status-ok)]',
  error: 'text-[var(--status-danger)]',
  info: 'text-[var(--status-info)]',
  loading: 'text-[var(--accent)]',
};

const ICON: Record<ToastKind, IconComponent | null> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  // Loading gets the Spinner instead.
  loading: null,
};

/** Errors stay up longest: they are the only kind you may need to read twice. */
const DURATION: Record<ToastKind, number> = {
  success: 3000,
  error: 6000,
  info: 4000,
  loading: Infinity,
};

interface ToastBodyProps {
  kind: ToastKind;
  message: JSX.Element;
  model: ToastModel;
}

function ToastBody(props: ToastBodyProps) {
  return (
    <div
      role={props.kind === 'error' ? 'alert' : 'status'}
      aria-live={props.kind === 'error' ? 'assertive' : 'polite'}
      class={cn(
        'pointer-events-auto flex w-[min(380px,calc(100vw-2rem))] items-stretch',
        'overflow-hidden rounded-sm border border-[var(--border-default)]',
        'bg-[var(--surface-overlay)] text-[var(--text-primary)]',
        'shadow-[var(--shadow-overlay)] transition-[opacity,transform] duration-150'
      )}
      style={{
        opacity: props.model.visible ? 1 : 0,
        transform: props.model.visible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      <span class={cn('w-[2px] shrink-0', BAR[props.kind])} aria-hidden="true" />

      <div class="flex min-w-0 flex-1 items-start gap-2 py-2 pr-1.5 pl-2.5">
        <span class={cn('mt-px shrink-0', GLYPH[props.kind])} aria-hidden="true">
          <Show when={ICON[props.kind]} fallback={<Spinner size={14} />}>
            {(icon) => <Dynamic component={icon()} size={14} />}
          </Show>
        </span>

        <div class="selectable min-w-0 flex-1 leading-snug break-words">{props.message}</div>

        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => solidToast.dismiss(props.model.id)}
          class={cn(
            'mt-px shrink-0 rounded-xs p-0.5 text-[var(--text-tertiary)] transition-colors',
            'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

const show = (kind: ToastKind, message: JSX.Element, options?: ToastOptions): string =>
  solidToast.custom(
    // `model` is annotated rather than inferred: `solid-toast`'s `Message` is a union
    // whose non-function branch (`JSX.Element`) is itself callable in Solid, so
    // contextual typing of the render form is ambiguous.
    (model: ToastModel) => <ToastBody kind={kind} message={message} model={model} />,
    { duration: DURATION[kind], ...options }
  );

/**
 * `sonner`-shaped toast API.
 *
 * Reusing an id upserts, which is how `promise` turns one loading toast into its
 * success or error outcome in place rather than stacking three.
 */
export const toast = {
  success: (message: JSX.Element, options?: ToastOptions) => show('success', message, options),
  error: (message: JSX.Element, options?: ToastOptions) => show('error', message, options),
  info: (message: JSX.Element, options?: ToastOptions) => show('info', message, options),
  loading: (message: JSX.Element, options?: ToastOptions) => show('loading', message, options),

  /** Dismiss one toast, or all of them when called with no id. */
  dismiss: (id?: string) => solidToast.dismiss(id),

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: JSX.Element;
      success: (value: T) => JSX.Element;
      error: (error: unknown) => JSX.Element;
    }
  ): Promise<T> => {
    const id = show('loading', messages.loading);
    promise.then(
      (value) => show('success', messages.success(value), { id }),
      (error: unknown) => show('error', messages.error(error), { id })
    );
    return promise;
  },
};

export interface ToasterProps {
  position?: ToastPosition;
}

/**
 * Mount once, at the app root.
 *
 * `position` is passed twice on purpose: `solid-toast` resolves a toast's position from
 * `toastOptions.position` *before* falling back to the container's `position`, and its
 * built-in `toastOptions` default is `top-right`. Setting only the container prop
 * silently leaves toasts in the top-right corner.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SolidToaster
      position={props.position ?? 'bottom-right'}
      gutter={8}
      toastOptions={{
        position: props.position ?? 'bottom-right',
        // Long enough for the 150ms exit transition to finish before unmount.
        unmountDelay: 250,
      }}
    />
  );
}
