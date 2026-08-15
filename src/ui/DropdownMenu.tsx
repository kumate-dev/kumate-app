/**
 * Row and toolbar action menu.
 *
 * The trigger is Kobalte's own `<button>` rather than a wrapped child, because a menu
 * trigger needs `aria-haspopup`, `aria-expanded` and arrow-key opening on the real
 * element. So this component takes the button's *contents* (`icon`, or `trigger` for
 * anything else) instead of a whole button, and styles it to match a ghost `IconButton`.
 *
 * `MenuItem` deliberately does not take an `onClick`. Kobalte's `onSelect` fires for
 * pointer *and* keyboard activation and runs after the menu has decided to close, which
 * is the difference between "Delete" working when you press Enter and it only working
 * when you click.
 */

import { Show, children, splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { DropdownMenu as KDropdownMenu } from '@kobalte/core/dropdown-menu';
import { Ellipsis } from 'lucide-solid';

import { cn } from '@/lib/k8s';

import { Kbd } from './Kbd';
import type { IconComponent, Placement } from './types';

export interface DropdownMenuProps {
  /** Accessible name for the trigger. Required: the trigger is usually just a glyph. */
  label: string;
  /** Trigger glyph. Defaults to a horizontal ellipsis. */
  icon?: IconComponent;
  /** Arbitrary trigger contents. Replaces `icon` when set. */
  trigger?: JSX.Element;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  triggerClass?: string;
  contentClass?: string;
  /** `MenuItem`s and `MenuSeparator`s. */
  children: JSX.Element;
}

export function DropdownMenu(props: DropdownMenuProps) {
  const [local] = splitProps(props, [
    'label',
    'icon',
    'trigger',
    'open',
    'onOpenChange',
    'placement',
    'triggerClass',
    'contentClass',
    'children',
  ]);

  // Memoised so the `<Show>` condition and the render do not each build the node.
  const trigger = children(() => local.trigger);

  return (
    <KDropdownMenu
      open={local.open}
      onOpenChange={local.onOpenChange}
      placement={local.placement ?? 'bottom-end'}
      gutter={4}
    >
      <KDropdownMenu.Trigger
        aria-label={local.label}
        class={cn(
          'inline-flex size-[var(--spacing-row)] shrink-0 items-center justify-center',
          'rounded-sm border border-transparent text-[var(--text-secondary)] transition-colors',
          'enabled:hover:bg-[var(--surface-hover)] enabled:hover:text-[var(--text-primary)]',
          'data-[expanded]:bg-[var(--surface-active)] data-[expanded]:text-[var(--text-primary)]',
          local.triggerClass
        )}
      >
        <Show when={trigger()} fallback={<Dynamic component={local.icon ?? Ellipsis} size={15} />}>
          {trigger()}
        </Show>
      </KDropdownMenu.Trigger>

      <KDropdownMenu.Portal>
        <KDropdownMenu.Content
          class={cn(
            'animate-in z-50 min-w-[180px] overflow-hidden rounded-sm border p-1 outline-none',
            'border-[var(--border-default)] bg-[var(--surface-overlay)]',
            'shadow-[var(--shadow-overlay)]',
            local.contentClass
          )}
        >
          {local.children}
        </KDropdownMenu.Content>
      </KDropdownMenu.Portal>
    </KDropdownMenu>
  );
}

export interface MenuItemProps {
  children: JSX.Element;
  /** Fires on click *and* on Enter/Space. */
  onSelect?: () => void;
  icon?: IconComponent;
  /** Shortcut hint, in `Kbd` syntax. Display only — bind the key yourself. */
  shortcut?: string;
  /** Destructive action: danger hue, and a danger-tinted highlight. */
  danger?: boolean;
  disabled?: boolean;
  /** Defaults to true (Kobalte's default). Set false for toggles. */
  closeOnSelect?: boolean;
  class?: string;
}

export function MenuItem(props: MenuItemProps) {
  const [local] = splitProps(props, [
    'children',
    'onSelect',
    'icon',
    'shortcut',
    'danger',
    'disabled',
    'closeOnSelect',
    'class',
  ]);

  return (
    <KDropdownMenu.Item
      onSelect={local.onSelect}
      disabled={local.disabled}
      closeOnSelect={local.closeOnSelect}
      class={cn(
        'flex h-[var(--spacing-row)] cursor-default items-center gap-2 select-none',
        'rounded-xs px-2 transition-colors outline-none',
        local.danger
          ? 'text-[var(--status-danger)] data-[highlighted]:bg-[var(--status-danger-subtle)]'
          : 'text-[var(--text-secondary)] data-[highlighted]:bg-[var(--surface-hover)] data-[highlighted]:text-[var(--text-primary)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        local.class
      )}
    >
      <Show when={local.icon}>
        {(icon) => <Dynamic component={icon()} size={14} class="shrink-0 opacity-80" />}
      </Show>
      <span class="min-w-0 flex-1 truncate">{local.children}</span>
      <Show when={local.shortcut}>
        {(shortcut) => <Kbd keys={shortcut()} size="sm" class="ml-2" />}
      </Show>
    </KDropdownMenu.Item>
  );
}

export interface MenuSeparatorProps {
  class?: string;
}

export function MenuSeparator(props: MenuSeparatorProps) {
  return (
    <KDropdownMenu.Separator
      class={cn('my-1 h-px border-0 bg-[var(--border-subtle)]', props.class)}
    />
  );
}
