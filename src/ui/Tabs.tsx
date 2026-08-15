/**
 * Underline tabs, for the sections of a resource detail panel (Overview, YAML, Events,
 * Logs).
 *
 * The moving underline is Kobalte's `Tabs.Indicator`, which measures the active trigger
 * and writes `left`/`width` inline — one animated element instead of a border on each
 * trigger, so the underline slides rather than jumping. That requires the list to be a
 * positioned ancestor; `relative` on `Tabs.List` is not decorative.
 *
 * Activation is automatic: arrowing along the tabs switches panels immediately, which
 * is right when panels are cheap and already loaded, and is what native tab strips do.
 */

import { For, splitProps, type JSX } from 'solid-js';
import { Tabs as KTabs } from '@kobalte/core/tabs';

import { cn } from '@/lib/k8s';

export interface TabItem {
  value: string;
  label: JSX.Element;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  class?: string;
  listClass?: string;
  /** `TabPanel`s. */
  children?: JSX.Element;
}

export function Tabs(props: TabsProps) {
  const [local] = splitProps(props, [
    'items',
    'value',
    'defaultValue',
    'onChange',
    'class',
    'listClass',
    'children',
  ]);

  return (
    <KTabs
      value={local.value}
      defaultValue={local.defaultValue}
      onChange={local.onChange}
      class={cn('flex min-h-0 flex-col', local.class)}
    >
      <KTabs.List
        class={cn(
          'relative flex shrink-0 items-center gap-1 border-b border-[var(--border-subtle)] px-1',
          local.listClass
        )}
      >
        <For each={local.items}>
          {(item) => (
            <KTabs.Trigger
              value={item.value}
              disabled={item.disabled}
              class={cn(
                'relative h-8 shrink-0 px-2 text-[var(--text-secondary)] select-none',
                'transition-colors hover:text-[var(--text-primary)]',
                'data-[selected]:text-[var(--text-primary)]',
                'disabled:pointer-events-none disabled:opacity-45'
              )}
            >
              {item.label}
            </KTabs.Trigger>
          )}
        </For>
        {/* Sits one pixel low so it covers the list's hairline rather than stacking on it. */}
        <KTabs.Indicator class="absolute -bottom-px h-0.5 bg-[var(--accent)] transition-all duration-150" />
      </KTabs.List>
      {local.children}
    </KTabs>
  );
}

export interface TabPanelProps {
  value: string;
  class?: string;
  children?: JSX.Element;
}

export function TabPanel(props: TabPanelProps) {
  return (
    <KTabs.Content
      value={props.value}
      class={cn('min-h-0 flex-1 overflow-y-auto outline-none', props.class)}
    >
      {props.children}
    </KTabs.Content>
  );
}
