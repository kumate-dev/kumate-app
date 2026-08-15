/**
 * Single-line text input, and the search field built on it.
 *
 * The bordered box is a wrapper `<div>`, not the `<input>` itself, so an icon and a
 * clear button can sit inside the same hairline. Consequences worth knowing:
 *
 * - The focus ring is drawn on the wrapper with `focus-within`, and the input's own
 *   ring is suppressed. `focus-within` rather than `:focus-visible` is deliberate:
 *   a text field should show focus when you click into it, not only when you tab.
 *
 * - Emptiness is tracked by a listener on the *wrapper*, because `input` bubbles. That
 *   leaves the caller's own `onInput` untouched in the spread, instead of this
 *   component having to unwrap Solid's `EventHandlerUnion` to chain it.
 *
 * - Clearing writes `''` to the element and dispatches a bubbling native `input` event.
 *   Solid delegates `input`, so a controlled caller's handler runs and its signal
 *   updates; without the dispatch the field would snap straight back to its old value.
 *   `onClear` is offered on top for callers that need to do more than reset a signal.
 *
 * `hint` is a slot shown only while the field is empty and unfocused — that is what
 * makes the `⌘K` affordance on `SearchInput` disappear the moment you start typing,
 * rather than fighting the clear button for the same corner.
 */

import { Show, createMemo, createSignal, splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Search, X } from 'lucide-solid';

import { cn } from '@/lib/k8s';

import { Kbd } from './Kbd';
import type { IconComponent } from './types';

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Leading glyph. Decorative; label the field with `aria-label` or a `<label>`. */
  icon?: IconComponent;
  /** Shows a clear button whenever the field has content. */
  clearable?: boolean;
  /** Applies the danger hairline and sets `aria-invalid`. */
  invalid?: boolean;
  /** Called after the field has been cleared and refocused. */
  onClear?: () => void;
  /** Always-visible trailing content, e.g. a unit suffix. */
  trailing?: JSX.Element;
  /** Trailing content shown only while the field is empty and unfocused. */
  hint?: JSX.Element;
  /** Class for the bordered wrapper. `class` styles the `<input>`. */
  wrapperClass?: string;
}

export function Input(props: InputProps) {
  const [local, others] = splitProps(props, [
    'icon',
    'clearable',
    'invalid',
    'onClear',
    'trailing',
    'hint',
    'class',
    'wrapperClass',
    'ref',
  ]);

  let field: HTMLInputElement | undefined;

  const [typed, setTyped] = createSignal('');
  const [focused, setFocused] = createSignal(false);

  // Controlled callers are the source of truth; uncontrolled ones fall back to what the
  // wrapper's bubbling `input` listener has seen.
  const hasValue = createMemo(() =>
    props.value !== undefined && props.value !== null
      ? String(props.value).length > 0
      : typed().length > 0
  );

  const attachRef = (node: HTMLInputElement) => {
    field = node;
    const forwarded = local.ref;
    if (typeof forwarded === 'function') forwarded(node);
  };

  const clear = () => {
    const node = field;
    if (!node) return;
    node.value = '';
    setTyped('');
    node.dispatchEvent(new Event('input', { bubbles: true }));
    local.onClear?.();
    node.focus();
  };

  const onWrapperKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !local.clearable || !hasValue()) return;
    // Only swallow Escape when it actually did something, so a dialog or drawer above
    // still closes on the second press.
    event.stopPropagation();
    event.preventDefault();
    clear();
  };

  return (
    <div
      class={cn(
        'flex h-[var(--spacing-row)] w-full items-center gap-1.5 rounded-sm border px-2',
        'bg-[var(--surface-inset)] transition-colors',
        'focus-within:[outline:2px_solid_var(--focus-ring)] focus-within:[outline-offset:-1px]',
        local.invalid
          ? 'border-[var(--status-danger)]'
          : 'border-[var(--border-default)] focus-within:border-[var(--accent-border)] hover:border-[var(--border-strong)]',
        props.disabled && 'cursor-not-allowed opacity-50',
        local.wrapperClass
      )}
      onInput={(event) => setTyped((event.target as HTMLInputElement).value)}
      onFocusIn={() => setFocused(true)}
      onFocusOut={() => setFocused(false)}
      onKeyDown={onWrapperKeyDown}
    >
      <Show when={local.icon}>
        {(icon) => (
          <Dynamic
            component={icon()}
            size={14}
            class="shrink-0 text-[var(--text-tertiary)]"
            aria-hidden="true"
          />
        )}
      </Show>

      <input
        // eslint-disable-next-line solid/reactivity -- callback ref, not an accessor; calling it would pass no element
        ref={attachRef}
        aria-invalid={local.invalid ? 'true' : undefined}
        class={cn(
          'h-full min-w-0 flex-1 bg-transparent text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)] focus-visible:outline-none',
          'disabled:cursor-not-allowed',
          local.class
        )}
        {...others}
      />

      <Show when={local.clearable && hasValue()}>
        <button
          type="button"
          aria-label="Clear"
          onClick={clear}
          class={cn(
            'shrink-0 rounded-xs p-0.5 text-[var(--text-tertiary)] transition-colors',
            'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <X size={12} />
        </button>
      </Show>

      {/* The condition deliberately does not look at `hint` itself: reading a JSX prop
          twice instantiates it twice, and one of the two would be thrown away. */}
      <Show when={!hasValue() && !focused()}>{local.hint}</Show>
      {local.trailing}
    </div>
  );
}

export interface SearchInputProps extends Omit<InputProps, 'icon' | 'clearable' | 'hint'> {
  /**
   * Shortcut shown while the field is idle, in `Kbd` syntax. `null` hides the hint —
   * use it for search fields that are not wired to a global shortcut, so the chip
   * never advertises a key that does nothing.
   */
  shortcut?: string | null;
}

export function SearchInput(props: SearchInputProps) {
  const [local, others] = splitProps(props, ['shortcut', 'placeholder']);

  return (
    <Input
      // Not `type="search"`: WebKit adds its own ✕ affordance to that type, which would
      // sit next to ours. `role` keeps the semantics.
      type="text"
      role="searchbox"
      icon={Search}
      clearable
      placeholder={local.placeholder ?? 'Search…'}
      hint={
        <Show when={local.shortcut !== null}>
          <Kbd keys={local.shortcut ?? 'mod+k'} size="sm" />
        </Show>
      }
      {...others}
    />
  );
}
