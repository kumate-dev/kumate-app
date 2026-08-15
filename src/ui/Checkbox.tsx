/**
 * Checkbox, including the indeterminate state a table's select-all header needs.
 *
 * Kobalte renders a visually hidden `<input type="checkbox">` and a separate styled
 * control, which is what makes the tri-state possible at all — `indeterminate` is a
 * DOM property, not an attribute, and cannot be expressed in markup. Note that in
 * Kobalte indeterminism is *presentational*: it stays until the caller clears it, so
 * the header must flip it to `false` itself when the selection resolves.
 *
 * The focus ring is drawn on a wrapper around the hidden input and the control, via
 * `:has()`. Putting it on the control alone is impossible (the control is never the
 * focused element) and putting it on the root would draw a ring around the label too.
 */

import { Show, children, splitProps, type JSX } from 'solid-js';
import { Checkbox as KCheckbox } from '@kobalte/core/checkbox';
import { Check, Minus } from 'lucide-solid';

import { cn } from '@/lib/k8s';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Presentational third state. Overrides the check glyph while set. */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Visible label. Omit it for table cells and pass `aria-label` instead. */
  label?: JSX.Element;
  /** Required when there is no visible `label`. */
  'aria-label'?: string;
  name?: string;
  value?: string;
  class?: string;
}

export function Checkbox(props: CheckboxProps) {
  const [local] = splitProps(props, [
    'checked',
    'defaultChecked',
    'indeterminate',
    'onChange',
    'disabled',
    'readOnly',
    'label',
    'aria-label',
    'name',
    'value',
    'class',
  ]);

  // Memoised so the `<Show>` condition and the render do not each build the node.
  const label = children(() => local.label);

  return (
    <KCheckbox
      checked={local.checked}
      defaultChecked={local.defaultChecked}
      indeterminate={local.indeterminate}
      onChange={local.onChange}
      disabled={local.disabled}
      readOnly={local.readOnly}
      name={local.name}
      value={local.value}
      class={cn(
        'inline-flex items-center gap-2 select-none',
        local.disabled && 'cursor-not-allowed opacity-45',
        local.class
      )}
    >
      <span
        class={cn(
          'relative inline-flex rounded-xs',
          'has-[input:focus-visible]:[outline:2px_solid_var(--focus-ring)]',
          'has-[input:focus-visible]:[outline-offset:2px]'
        )}
      >
        <KCheckbox.Input aria-label={local['aria-label']} />
        <KCheckbox.Control
          class={cn(
            'flex size-3.5 shrink-0 items-center justify-center rounded-xs border',
            'border-[var(--border-strong)] bg-[var(--surface-inset)] transition-colors',
            'data-[checked]:border-[var(--accent)] data-[checked]:bg-[var(--accent)]',
            'data-[indeterminate]:border-[var(--accent)] data-[indeterminate]:bg-[var(--accent)]'
          )}
        >
          <KCheckbox.Indicator class="flex items-center justify-center text-[var(--text-inverted)]">
            <Show when={local.indeterminate} fallback={<Check size={11} strokeWidth={3} />}>
              <Minus size={11} strokeWidth={3} />
            </Show>
          </KCheckbox.Indicator>
        </KCheckbox.Control>
      </span>

      <Show when={label()}>
        <KCheckbox.Label class="text-[var(--text-secondary)]">{label()}</KCheckbox.Label>
      </Show>
    </KCheckbox>
  );
}
