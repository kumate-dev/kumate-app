/**
 * Select, generic over the option type.
 *
 * Options are whatever the caller already has — a `V1Namespace`, a context name, a
 * plain string — and the three accessors say how to read a key, a label and a disabled
 * flag off it. Nothing has to be mapped into `{ value, label }` shape first, which is
 * the difference between a select that fits the resource model and one the resource
 * model has to be flattened for.
 *
 * `T` is constrained to be non-nullable. Kobalte types its option accessors against
 * `Exclude<NonNullable<Option>, null>`, which TypeScript cannot reduce while `T` is an
 * unresolved, possibly-nullable generic — the parameter position then fails to check.
 * Constraining `T` makes that type reduce to `T`, so the accessors type-check directly
 * and no casts are needed. Absence is expressed by `value: null`, not by a null option.
 *
 * `sameWidth` is Kobalte's default, so the listbox matches the trigger — a namespace
 * picker whose popup is wider than its button looks like a bug.
 */

import { Show, type JSX } from 'solid-js';
import { Select as KSelect } from '@kobalte/core/select';
import { Check, ChevronDown } from 'lucide-solid';

import { cn } from '@/lib/k8s';

import type { Placement } from './types';

export interface SelectProps<T extends NonNullable<unknown>> {
  options: T[];
  value?: T | null;
  onChange?: (value: T | null) => void;
  /** Stable identity of an option. Defaults to `String(option)`. */
  optionValue?: (option: T) => string;
  /** Display text, also used for typeahead. Defaults to `String(option)`. */
  optionLabel?: (option: T) => string;
  optionDisabled?: (option: T) => boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Required when there is no visible `label`. */
  'aria-label'?: string;
  label?: string;
  placement?: Placement;
  size?: 'sm' | 'md';
  class?: string;
  /** Class for the popup panel. */
  contentClass?: string;
}

const TRIGGER_SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-6 px-1.5 text-2xs',
  md: 'h-[var(--spacing-row)] px-2',
};

export function Select<T extends NonNullable<unknown>>(props: SelectProps<T>): JSX.Element {
  const labelOf = (option: T) => (props.optionLabel ? props.optionLabel(option) : String(option));
  const valueOf = (option: T) => (props.optionValue ? props.optionValue(option) : String(option));
  const disabledOf = (option: T) => props.optionDisabled?.(option) ?? false;

  return (
    <KSelect
      options={props.options}
      value={props.value ?? null}
      onChange={(value) => props.onChange?.(value)}
      optionValue={valueOf}
      optionTextValue={labelOf}
      optionDisabled={disabledOf}
      disabled={props.disabled}
      placement={props.placement ?? 'bottom-start'}
      placeholder={
        <span class="text-[var(--text-tertiary)]">{props.placeholder ?? 'Select…'}</span>
      }
      itemComponent={(itemProps) => (
        <KSelect.Item
          item={itemProps.item}
          class={cn(
            'flex cursor-default items-center justify-between gap-2 rounded-xs select-none',
            'px-2 py-1 text-[var(--text-secondary)] outline-none',
            'data-[highlighted]:bg-[var(--surface-hover)] data-[highlighted]:text-[var(--text-primary)]',
            'data-[selected]:text-[var(--text-primary)]',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-45'
          )}
        >
          <KSelect.ItemLabel class="truncate">{labelOf(itemProps.item.rawValue)}</KSelect.ItemLabel>
          <KSelect.ItemIndicator class="shrink-0 text-[var(--accent)]">
            <Check size={13} strokeWidth={2.5} />
          </KSelect.ItemIndicator>
        </KSelect.Item>
      )}
    >
      <Show when={props.label}>
        {(label) => (
          <KSelect.Label class="text-2xs mb-1 block text-[var(--text-tertiary)]">
            {label()}
          </KSelect.Label>
        )}
      </Show>

      <KSelect.Trigger
        aria-label={props['aria-label']}
        class={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-sm border',
          'border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)]',
          'transition-colors enabled:hover:bg-[var(--surface-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-45',
          TRIGGER_SIZE[props.size ?? 'md'],
          props.class
        )}
      >
        <KSelect.Value<T> class="truncate text-left">
          {(state) => labelOf(state.selectedOption())}
        </KSelect.Value>
        <KSelect.Icon class="shrink-0 text-[var(--text-tertiary)]">
          <ChevronDown size={13} />
        </KSelect.Icon>
      </KSelect.Trigger>

      <KSelect.Portal>
        <KSelect.Content
          class={cn(
            'animate-in z-50 overflow-hidden rounded-sm border border-[var(--border-default)]',
            'bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)]',
            props.contentClass
          )}
        >
          <KSelect.Listbox class="max-h-[280px] overflow-y-auto p-1 outline-none" />
        </KSelect.Content>
      </KSelect.Portal>
    </KSelect>
  );
}
