/**
 * The application chrome: what cluster, what namespaces, and how to get anywhere else.
 *
 * Left to right — cluster switcher, namespace filter, palette entry, theme, settings.
 * Everything is a hairline-separated cell in a single 36px row; there are no cards and
 * no shadows in the chrome, which is what makes this read as a native title bar rather
 * than as a web header.
 *
 * ## The search field is the palette
 *
 * It looks like a filter, but typing into it opens the command palette seeded with the
 * first keystroke and the field resets. That is deliberate: this app has no meaningful
 * "global search over the cluster" — the useful search is *navigation* — and shipping a
 * field that looks like search but only navigates would be worse than the redirect.
 * `/` focuses this field, so the keyboard path is `/`, type, Enter.
 *
 * ## Namespace semantics
 *
 * `ALL_NAMESPACES` is a sentinel, not a namespace, and is mutually exclusive with any
 * real selection (`stores/namespaces.ts` enforces that). So the sentinel gets its own
 * row above a separator rather than being one checkbox among many — the old UI let you
 * tick both, which sent a filter the backend then ignored.
 */

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js';
import { Check, ChevronDown, Download, Moon, RotateCw, Settings, Sun } from 'lucide-solid';

import type { K8sContext } from '@/api/k8s/contexts';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { cn } from '@/lib/k8s';
import {
  contexts,
  importContexts,
  isConnected,
  refreshConnections,
  selectCluster,
  selectedContext,
  selectedName,
  setConnected,
} from '@/stores/clusters';
import {
  isAllNamespaces,
  namespaces,
  selectedNamespaces,
  setSelectedNamespaces,
  toggleNamespace,
} from '@/stores/namespaces';
import { resolvedTheme, setTheme, theme } from '@/stores/theme';
import { DropdownMenu, MenuItem, MenuSeparator } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { SearchInput } from '@/ui/Input';
import { Kbd } from '@/ui/Kbd';
import { toast } from '@/ui/Toast';
import { encodeBytesToBase64 } from '@/utils/base64';
import { getErrorMessage } from '@/utils/error';
import { stringToHslColor } from '@/utils/string';

import { openPalette, registerSearchInput } from './shortcuts';

/**
 * `DropdownMenu`'s trigger is a `--spacing-row` square, which is right for a row action
 * and wrong for a labelled picker. `w-auto!` rather than `w-auto` because tailwind-merge
 * scopes conflicts by important-modifier, so the base `size-*` survives the merge and the
 * two would otherwise be decided by stylesheet order. The height from `size-*` is exactly
 * what we want, so only the width is overridden.
 */
const PICKER_TRIGGER = 'w-auto! max-w-[220px] justify-start gap-2 px-2';

/** The backend normalises every stored avatar to WebP. */
const avatarUrl = (context: K8sContext): string | undefined => {
  const bytes = context.avatar;
  if (!bytes || bytes.length === 0) return undefined;
  return `data:image/webp;base64,${encodeBytesToBase64(bytes)}`;
};

const displayNameOf = (context: K8sContext): string => context.display_name || context.name;

interface ClusterAvatarProps {
  context: K8sContext;
  size: number;
}

function ClusterAvatar(props: ClusterAvatarProps): JSX.Element {
  const url = createMemo(() => avatarUrl(props.context));
  const initial = () => displayNameOf(props.context).charAt(0).toUpperCase() || '?';

  return (
    <span
      class={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xs',
        'text-2xs font-semibold text-[var(--text-inverted)]'
      )}
      style={{
        width: `${props.size}px`,
        height: `${props.size}px`,
        // Deterministic per name so a cluster keeps the same colour across launches.
        // Not a token: the point is that every cluster differs from its neighbours.
        background: url() ? 'transparent' : stringToHslColor(props.context.name, 55, 45),
      }}
      aria-hidden="true"
    >
      <Show when={url()} fallback={initial()}>
        {(source) => <img src={source()} alt="" class="h-full w-full object-cover" />}
      </Show>
    </span>
  );
}

interface ConnectionDotProps {
  connected: boolean;
}

function ConnectionDot(props: ConnectionDotProps): JSX.Element {
  return (
    <span
      class={cn(
        'size-1.5 shrink-0 rounded-full',
        props.connected ? 'bg-[var(--status-ok)]' : 'bg-[var(--text-tertiary)]'
      )}
      aria-hidden="true"
    />
  );
}

function ClusterSwitcher(): JSX.Element {
  const current = createMemo(selectedContext);

  const toggleConnection = async (name: string, next: boolean) => {
    try {
      await setConnected(name, next);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <DropdownMenu
      label="Switch cluster"
      placement="bottom-start"
      triggerClass={PICKER_TRIGGER}
      contentClass="max-h-[min(420px,60vh)] min-w-[240px] overflow-y-auto"
      trigger={
        <Show
          when={current()}
          fallback={<span class="text-[var(--text-tertiary)]">No cluster</span>}
        >
          {(context) => (
            <>
              <ConnectionDot connected={isConnected(context().name)} />
              <ClusterAvatar context={context()} size={16} />
              <span class="min-w-0 flex-1 truncate text-left text-[var(--text-primary)]">
                {displayNameOf(context())}
              </span>
              <ChevronDown size={12} class="shrink-0 opacity-60" />
            </>
          )}
        </Show>
      }
    >
      <Show
        when={(contexts() ?? []).length > 0}
        fallback={
          <p class="text-2xs px-2 py-2 text-[var(--text-tertiary)]">
            No contexts. Import them from the settings menu.
          </p>
        }
      >
        <For each={contexts() ?? []}>
          {(context) => (
            <MenuItem onSelect={() => selectCluster(context.name)}>
              <span class="flex w-full items-center gap-2">
                <ConnectionDot connected={isConnected(context.name)} />
                <ClusterAvatar context={context} size={16} />
                <span class="min-w-0 flex-1 truncate">{displayNameOf(context)}</span>
                <Show when={context.name === selectedName()}>
                  <Check size={13} class="shrink-0 text-[var(--accent)]" />
                </Show>
              </span>
            </MenuItem>
          )}
        </For>
      </Show>

      <Show when={current()}>
        {(context) => (
          <>
            <MenuSeparator />
            <MenuItem
              danger={isConnected(context().name)}
              onSelect={() => void toggleConnection(context().name, !isConnected(context().name))}
            >
              {isConnected(context().name) ? 'Disconnect' : 'Connect'}
            </MenuItem>
          </>
        )}
      </Show>
    </DropdownMenu>
  );
}

function NamespacePicker(): JSX.Element {
  const label = createMemo(() => {
    if (isAllNamespaces()) return ALL_NAMESPACES;
    const selection = selectedNamespaces();
    const first = selection[0];
    if (selection.length === 1 && first) return first;
    return `${selection.length} namespaces`;
  });

  return (
    <DropdownMenu
      label="Filter namespaces"
      placement="bottom-start"
      triggerClass={PICKER_TRIGGER}
      contentClass="max-h-[min(420px,60vh)] min-w-[220px] overflow-y-auto"
      trigger={
        <>
          <span class="min-w-0 flex-1 truncate text-left text-[var(--text-secondary)]">
            {label()}
          </span>
          <ChevronDown size={12} class="shrink-0 opacity-60" />
        </>
      }
    >
      {/* closeOnSelect stays on for the sentinel: picking "all" is a terminal choice. */}
      <MenuItem onSelect={() => setSelectedNamespaces([ALL_NAMESPACES])}>
        <span class="flex w-full items-center gap-2">
          <span class="min-w-0 flex-1 truncate">{ALL_NAMESPACES}</span>
          <Show when={isAllNamespaces()}>
            <Check size={13} class="shrink-0 text-[var(--accent)]" />
          </Show>
        </span>
      </MenuItem>

      <MenuSeparator />

      <Show
        when={namespaces().length > 0}
        fallback={
          <p class="text-2xs px-2 py-2 text-[var(--text-tertiary)]">No namespaces loaded.</p>
        }
      >
        <For each={namespaces()}>
          {(name) => (
            <MenuItem closeOnSelect={false} onSelect={() => toggleNamespace(name)}>
              <span class="flex w-full items-center gap-2">
                <span class="min-w-0 flex-1 truncate">{name}</span>
                <Show when={!isAllNamespaces() && selectedNamespaces().includes(name)}>
                  <Check size={13} class="shrink-0 text-[var(--accent)]" />
                </Show>
              </span>
            </MenuItem>
          )}
        </For>
      </Show>
    </DropdownMenu>
  );
}

function SettingsMenu(): JSX.Element {
  const [importing, setImporting] = createSignal(false);

  const runImport = async () => {
    if (importing()) return;
    setImporting(true);
    try {
      await importContexts();
      await refreshConnections();
      toast.success('Imported contexts from ~/.kube');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const themeItem = (value: 'system' | 'light' | 'dark', label: string) => (
    <MenuItem onSelect={() => setTheme(value)}>
      <span class="flex w-full items-center gap-2">
        <span class="min-w-0 flex-1 truncate">{label}</span>
        <Show when={theme() === value}>
          <Check size={13} class="shrink-0 text-[var(--accent)]" />
        </Show>
      </span>
    </MenuItem>
  );

  return (
    <DropdownMenu label="Settings" icon={Settings} placement="bottom-end">
      <MenuItem icon={Download} disabled={importing()} onSelect={() => void runImport()}>
        Import contexts from ~/.kube
      </MenuItem>
      <MenuItem icon={RotateCw} onSelect={() => void refreshConnections()}>
        Refresh connections
      </MenuItem>

      <MenuSeparator />

      {themeItem('system', 'Theme: system')}
      {themeItem('light', 'Theme: light')}
      {themeItem('dark', 'Theme: dark')}
    </DropdownMenu>
  );
}

export function TopBar(): JSX.Element {
  const cell = 'flex items-center gap-2 border-r border-[var(--border-subtle)] px-2';

  // The element is registered so `/` can focus it, and unregistered on unmount so the
  // shortcut never holds a detached node alive.
  onCleanup(() => registerSearchInput(undefined));

  const handOffToPalette = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    const typed = event.currentTarget.value;
    if (typed.length === 0) return;
    // The field is permanently empty (`value` is bound to ''), so Solid will not rewrite
    // the DOM value for us — clear it by hand before the palette takes over.
    event.currentTarget.value = '';
    openPalette(typed);
  };

  return (
    <header
      class={cn(
        'flex h-9 shrink-0 items-center border-b border-[var(--border-default)]',
        'bg-[var(--surface-raised)]'
      )}
    >
      <div class={cn(cell, 'pl-2')}>
        <ClusterSwitcher />
      </div>

      <div class={cell}>
        <NamespacePicker />
      </div>

      <div class="flex min-w-0 flex-1 items-center px-2">
        <SearchInput
          ref={registerSearchInput}
          value=""
          shortcut="mod+k"
          aria-label="Search resources, clusters and namespaces"
          placeholder="Search resources, clusters, namespaces…"
          wrapperClass="max-w-[420px]"
          onInput={handOffToPalette}
          onKeyDown={(event) => {
            if (event.key === 'Enter') openPalette('');
          }}
        />
      </div>

      <div class="flex items-center gap-1 border-l border-[var(--border-subtle)] px-2">
        <button
          type="button"
          onClick={() => openPalette('')}
          aria-label="Open command palette"
          class={cn(
            'flex h-[var(--spacing-row)] items-center gap-1.5 rounded-sm px-2',
            'text-[var(--text-tertiary)] transition-colors',
            'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <span class="text-2xs">Commands</span>
          <Kbd keys="mod+k" size="sm" />
        </button>

        <IconButton
          icon={resolvedTheme() === 'dark' ? Sun : Moon}
          label={resolvedTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          size="sm"
          onClick={() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')}
        />

        <SettingsMenu />
      </div>
    </header>
  );
}
